import assert from "node:assert";
import { randomUUID } from "node:crypto";
import { createTestApp } from "../../../test/support/test-app.ts";
import type { TestApp } from "../../../test/support/test-app.ts";
import { seedUser } from "../../../test/support/seed.ts";
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
      phone: null,
      photoUrl: null,
      pixKeyRegistered: false,
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

  function update(headers: { authorization: string }, payload: Record<string, unknown>) {
    return testApp.app.inject({ method: "PATCH", url: "/profile", headers, payload });
  }

  it("changes the nickname and the phone without touching the registration", async () => {
    const { headers } = await testApp.signIn();
    await register(headers);

    const nickname = await update(headers, { nickname: "  Aninha " });
    const phone = await update(headers, { phone: "51998765432" });
    const read = await testApp.app.inject({ method: "GET", url: "/profile", headers });

    assert.strictEqual(nickname.statusCode, 200);
    assert.strictEqual(phone.statusCode, 200);
    assert.deepStrictEqual(phone.json(), read.json());
    assert.strictEqual(read.json().nickname, "Aninha");
    assert.strictEqual(read.json().phone, "51998765432");
    assert.strictEqual(read.json().fullName, "Ana Souza Lima");
    assert.strictEqual(read.json().cpf, "11144477735");
  });

  it("refuses to change the locked fields and a phone without 11 digits", async () => {
    const { headers } = await testApp.signIn();
    await register(headers);

    const fullName = await update(headers, { fullName: "Outra Pessoa" });
    const birthDate = await update(headers, { birthDate: "2000-01-01" });
    const phone = await update(headers, { phone: "5198765432" });

    assert.strictEqual(fullName.statusCode, 400);
    assert.strictEqual(birthDate.statusCode, 400);
    assert.strictEqual(phone.statusCode, 400);
  });

  it("hands out an upload url inside the user folder and later shows the photo url", async () => {
    const { userId, headers } = await testApp.signIn();

    const upload = await testApp.app.inject({
      method: "POST",
      url: "/profile/photo-upload",
      headers,
      payload: { contentType: "image/png" },
    });
    const { path, uploadUrl, token } = upload.json();
    const saved = await update(headers, { photoPath: path });

    assert.strictEqual(upload.statusCode, 200);
    assert.match(path, new RegExp(`^${userId}/[0-9a-f-]{36}\\.png$`));
    assert.strictEqual(uploadUrl, `https://storage.example.com/upload/${path}`);
    assert.strictEqual(token, "upload-token");
    assert.strictEqual(saved.json().photoUrl, `https://storage.example.com/public/${path}`);
  });

  it("refuses a photo that was uploaded to another user's folder", async () => {
    const { headers } = await testApp.signIn();

    const response = await update(headers, { photoPath: `${randomUUID()}/${randomUUID()}.png` });

    assert.strictEqual(response.statusCode, 422);
    assert.strictEqual(response.json().code, "photoNotOwned");
  });

  it("follows the e-mail of the token after it changes in Supabase", async () => {
    const { userId, headers } = await testApp.signIn({ email: "ana@example.com" });
    await testApp.app.inject({ method: "GET", url: "/profile", headers });
    const changed = await testApp.signIn({ userId, email: "ana.nova@example.com" });

    const read = await testApp.app.inject({ method: "GET", url: "/profile", headers: changed.headers });

    assert.strictEqual(read.json().email, "ana.nova@example.com");
  });

  it("deactivates the account, keeps the wallet and refuses the next login", async () => {
    const { userId, headers } = await testApp.signIn();
    await register(headers);

    const deleted = await testApp.app.inject({ method: "DELETE", url: "/profile", headers });
    const next = await testApp.app.inject({ method: "GET", url: "/profile", headers });
    const user = await testPrisma.user.findUniqueOrThrow({ where: { id: userId } });

    assert.strictEqual(deleted.statusCode, 204);
    assert.strictEqual(next.statusCode, 403);
    assert.strictEqual(next.json().code, "accountDisabled");
    assert.strictEqual(user.active, false);
    assert.deepStrictEqual(user.deactivatedAt, testApp.clock.now);
    assert.strictEqual(user.cpf, "11144477735");
  });

  it("refuses to delete an account that is in an open match", async () => {
    const { userId, headers } = await testApp.signIn();
    const playerIds = [await seedUser({ userId, balance: 5000 }), await seedUser({ balance: 5000 }), await seedUser({ balance: 5000 })];
    await testApp.app.inject({ method: "POST", url: "/internal/matches", headers: testApp.serviceHeaders, payload: { table: 1, playerIds } });

    const response = await testApp.app.inject({ method: "DELETE", url: "/profile", headers });

    assert.strictEqual(response.statusCode, 409);
    assert.strictEqual(response.json().code, "playerAlreadyInMatch");
    assert.strictEqual((await testPrisma.user.findUniqueOrThrow({ where: { id: userId } })).active, true);
  });

  it("registers the Pix key of the CPF once, and repeating the call changes nothing", async () => {
    const { userId, headers } = await testApp.signIn();
    await register(headers);

    const first = await testApp.app.inject({ method: "PUT", url: "/profile/pix-key", headers });
    const registeredAt = (await testPrisma.user.findUniqueOrThrow({ where: { id: userId } })).pixKeyRegisteredAt;
    testApp.clock.now = new Date("2026-11-03T15:00:00Z");
    const again = await testApp.app.inject({ method: "PUT", url: "/profile/pix-key", headers });
    const user = await testPrisma.user.findUniqueOrThrow({ where: { id: userId } });
    testApp.clock.now = new Date("2026-11-02T15:00:00Z");

    assert.strictEqual(first.statusCode, 200);
    assert.strictEqual(first.json().pixKeyRegistered, true);
    assert.deepStrictEqual(again.json(), first.json());
    assert.deepStrictEqual(registeredAt, new Date("2026-11-02T15:00:00Z"));
    assert.deepStrictEqual(user.pixKeyRegisteredAt, registeredAt);
  });

  it("refuses the Pix key before the registration", async () => {
    const { headers } = await testApp.signIn();

    const response = await testApp.app.inject({ method: "PUT", url: "/profile/pix-key", headers });

    assert.strictEqual(response.statusCode, 409);
    assert.strictEqual(response.json().code, "registrationRequired");
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

    assert.deepStrictEqual(Object.keys(response.json()).sort(), ["birthDate", "complete", "cpf", "email", "fullName", "id", "nickname", "phone", "photoUrl", "pixKeyRegistered"]);
  });
});
