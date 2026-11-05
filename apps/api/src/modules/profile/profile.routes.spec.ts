import assert from "node:assert";
import { createTestApp } from "../../../test/support/test-app.ts";
import type { TestApp } from "../../../test/support/test-app.ts";
import { testPrisma } from "../../../test/support/test-database.ts";

describe("profile routes", () => {
  let testApp: TestApp;

  before(async () => {
    testApp = await createTestApp();
  });
  after(async () => testApp.app.close());
  beforeEach(async () => testApp.reset());

  it("creates the user on the first access and reports an incomplete profile", async () => {
    const { userId, email, headers } = await testApp.signIn({ email: "ana@example.com" });

    const response = await testApp.app.inject({ method: "GET", url: "/profile", headers });

    assert.strictEqual(response.statusCode, 200);
    assert.deepStrictEqual(response.json(), {
      id: userId,
      email,
      nickname: null,
      fullName: null,
      cpf: null,
      birthDate: null,
      photoUrl: null,
      complete: false,
    });
    assert.strictEqual(await testPrisma.user.count({ where: { id: userId } }), 1);
  });

  it("creates the user once when the first requests of a new account arrive at the same time", async () => {
    const statuses: number[] = [];

    for (let attempt = 0; attempt < 10; attempt++) {
      const { headers } = await testApp.signIn();
      const responses = await Promise.all([
        testApp.app.inject({ method: "GET", url: "/profile", headers }),
        testApp.app.inject({ method: "GET", url: "/wallet", headers }),
        testApp.app.inject({ method: "GET", url: "/profile", headers }),
        testApp.app.inject({ method: "GET", url: "/wallet/entries", headers }),
      ]);
      statuses.push(...responses.map(({ statusCode }) => statusCode));
    }

    assert.deepStrictEqual([...new Set(statuses)], [200]);
    assert.strictEqual(await testPrisma.user.count(), 10);
  });

  it("answers 401 without a token, with the fixed error envelope", async () => {
    const response = await testApp.app.inject({ method: "GET", url: "/profile" });

    assert.strictEqual(response.statusCode, 401);
    const body = response.json();
    assert.strictEqual(body.code, "invalidToken");
    assert.deepStrictEqual(Object.keys(body).sort(), ["code", "message", "statusCode"]);
  });

  it("answers 401 for a token signed by someone else", async () => {
    const response = await testApp.app.inject({
      method: "GET",
      url: "/profile",
      headers: { authorization: "Bearer eyJhbGciOiJFUzI1NiJ9.e30.invalid" },
    });

    assert.strictEqual(response.statusCode, 401);
    assert.strictEqual(response.json().code, "invalidToken");
  });

  it("answers 403 for a deactivated account", async () => {
    const { userId, headers } = await testApp.signIn();
    await testApp.app.inject({ method: "GET", url: "/profile", headers });
    await testPrisma.user.update({ where: { id: userId }, data: { active: false } });

    const response = await testApp.app.inject({ method: "GET", url: "/profile", headers });

    assert.strictEqual(response.statusCode, 403);
    assert.strictEqual(response.json().code, "accountDisabled");
  });

  const registration = { fullName: "Ana Souza Lima", cpf: "11144477735", birthDate: "1990-05-20", nickname: "Ana" };

  function register(headers: { authorization: string }, payload: Record<string, unknown> = registration) {
    return testApp.app.inject({ method: "POST", url: "/profile/registration", headers, payload });
  }

  it("registers full name, CPF, birth date and nickname and completes the profile", async () => {
    const { headers } = await testApp.signIn();

    const saved = await register(headers, { ...registration, fullName: "  Ana Souza Lima ", nickname: "  Ana  " });
    const read = await testApp.app.inject({ method: "GET", url: "/profile", headers });

    assert.strictEqual(saved.statusCode, 200);
    assert.deepStrictEqual(saved.json(), read.json());
    assert.strictEqual(read.json().fullName, "Ana Souza Lima");
    assert.strictEqual(read.json().cpf, "11144477735");
    assert.strictEqual(read.json().birthDate, "1990-05-20");
    assert.strictEqual(read.json().nickname, "Ana");
    assert.strictEqual(read.json().complete, true);
  });

  it("locks the registration once it is saved", async () => {
    const { headers } = await testApp.signIn();
    await register(headers);

    const again = await register(headers, { ...registration, fullName: "Outra Pessoa", cpf: "12345678909" });
    const read = await testApp.app.inject({ method: "GET", url: "/profile", headers });

    assert.strictEqual(again.statusCode, 409);
    assert.strictEqual(again.json().code, "registrationLocked");
    assert.strictEqual(read.json().fullName, "Ana Souza Lima");
    assert.strictEqual(read.json().cpf, "11144477735");
  });

  it("locks the registration when two requests of the same account arrive at the same time", async () => {
    const { headers } = await testApp.signIn();
    await testApp.app.inject({ method: "GET", url: "/profile", headers });

    const responses = await Promise.all([register(headers), register(headers, { ...registration, cpf: "12345678909" })]);

    assert.deepStrictEqual(responses.map(({ statusCode }) => statusCode).sort(), [200, 409]);
  });

  it("refuses a CPF that already has an account", async () => {
    const first = await testApp.signIn();
    const second = await testApp.signIn();
    await register(first.headers);

    const response = await register(second.headers, { ...registration, fullName: "Bia" });
    const read = await testApp.app.inject({ method: "GET", url: "/profile", headers: second.headers });

    assert.strictEqual(response.statusCode, 409);
    assert.strictEqual(response.json().code, "cpfAlreadyRegistered");
    assert.strictEqual(read.json().complete, false);
  });

  it("refuses the same CPF for two accounts registering at the same time", async () => {
    const first = await testApp.signIn();
    const second = await testApp.signIn();
    await testApp.app.inject({ method: "GET", url: "/profile", headers: first.headers });
    await testApp.app.inject({ method: "GET", url: "/profile", headers: second.headers });

    const responses = await Promise.all([register(first.headers), register(second.headers)]);

    assert.deepStrictEqual(responses.map(({ statusCode }) => statusCode).sort(), [200, 409]);
    assert.ok(responses.some((response) => response.json().code === "cpfAlreadyRegistered"));
  });

  it("keeps the nickname and birth date of an old account until it registers", async () => {
    const { userId, headers } = await testApp.signIn();
    await testApp.app.inject({ method: "GET", url: "/profile", headers });
    await testPrisma.user.update({ where: { id: userId }, data: { nickname: "Aninha", birthDate: new Date("1990-05-20") } });

    const read = await testApp.app.inject({ method: "GET", url: "/profile", headers });

    assert.strictEqual(read.json().nickname, "Aninha");
    assert.strictEqual(read.json().birthDate, "1990-05-20");
    assert.strictEqual(read.json().complete, false);
  });

  it("blocks someone under 18 using the Brasilia date", async () => {
    const { headers } = await testApp.signIn();
    testApp.clock.now = new Date("2026-11-03T01:30:00Z");

    const response = await register(headers, { ...registration, birthDate: "2008-11-03" });

    assert.strictEqual(response.statusCode, 422);
    assert.strictEqual(response.json().code, "underage");
    testApp.clock.now = new Date("2026-11-02T15:00:00Z");
  });

  it("rejects fields the API does not know", async () => {
    const { headers } = await testApp.signIn();

    const response = await register(headers, { ...registration, active: false });

    assert.strictEqual(response.statusCode, 400);
  });

  it("rejects an invalid birth date, an invalid CPF and a nickname that is too long", async () => {
    const { headers } = await testApp.signIn();

    const badDate = await register(headers, { ...registration, birthDate: "1990-02-31" });
    const badCpf = await register(headers, { ...registration, cpf: "11144477736" });
    const longNickname = await register(headers, { ...registration, nickname: "A".repeat(21) });

    assert.strictEqual(badDate.statusCode, 400);
    assert.strictEqual(badCpf.statusCode, 400);
    assert.strictEqual(longNickname.statusCode, 400);
  });

  it("hands out an upload url inside the user folder", async () => {
    const { userId, headers } = await testApp.signIn();

    const upload = await testApp.app.inject({
      method: "POST",
      url: "/profile/photo-upload",
      headers,
      payload: { contentType: "image/png" },
    });
    const { path, uploadUrl, token } = upload.json();

    assert.strictEqual(upload.statusCode, 200);
    assert.match(path, new RegExp(`^${userId}/[0-9a-f-]{36}\\.png$`));
    assert.strictEqual(uploadUrl, `https://storage.example.com/upload/${path}`);
    assert.strictEqual(token, "upload-token");
  });

  it("refuses to sign an upload for an unsupported content type", async () => {
    const { headers } = await testApp.signIn();

    const response = await testApp.app.inject({
      method: "POST",
      url: "/profile/photo-upload",
      headers,
      payload: { contentType: "application/pdf" },
    });

    assert.strictEqual(response.statusCode, 400);
  });

  it("never exposes fields outside the contract", async () => {
    const { headers } = await testApp.signIn();

    const response = await testApp.app.inject({ method: "GET", url: "/profile", headers });

    assert.deepStrictEqual(Object.keys(response.json()).sort(), ["birthDate", "complete", "cpf", "email", "fullName", "id", "nickname", "photoUrl"]);
  });
});
