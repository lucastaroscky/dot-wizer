import assert from "node:assert";
import { randomUUID } from "node:crypto";
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
      name: null,
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

  it("saves name and birth date and completes the profile", async () => {
    const { headers } = await testApp.signIn();

    const saved = await testApp.app.inject({
      method: "PUT",
      url: "/profile",
      headers,
      payload: { name: "  Ana  ", birthDate: "1990-05-20" },
    });
    const read = await testApp.app.inject({ method: "GET", url: "/profile", headers });

    assert.strictEqual(saved.statusCode, 200);
    assert.strictEqual(read.json().name, "Ana");
    assert.strictEqual(read.json().birthDate, "1990-05-20");
    assert.strictEqual(read.json().complete, true);
  });

  it("blocks someone under 18 using the Brasilia date", async () => {
    const { headers } = await testApp.signIn();
    testApp.clock.now = new Date("2026-11-03T01:30:00Z");

    const response = await testApp.app.inject({
      method: "PUT",
      url: "/profile",
      headers,
      payload: { name: "Ana", birthDate: "2008-11-03" },
    });

    assert.strictEqual(response.statusCode, 422);
    assert.strictEqual(response.json().code, "underage");
    testApp.clock.now = new Date("2026-11-02T15:00:00Z");
  });

  it("rejects fields the API does not know", async () => {
    const { headers } = await testApp.signIn();

    const response = await testApp.app.inject({
      method: "PUT",
      url: "/profile",
      headers,
      payload: { name: "Ana", birthDate: "1990-05-20", active: false },
    });

    assert.strictEqual(response.statusCode, 400);
  });

  it("rejects an invalid birth date and a name that is too long", async () => {
    const { headers } = await testApp.signIn();

    const badDate = await testApp.app.inject({
      method: "PUT",
      url: "/profile",
      headers,
      payload: { name: "Ana", birthDate: "1990-02-31" },
    });
    const longName = await testApp.app.inject({
      method: "PUT",
      url: "/profile",
      headers,
      payload: { name: "A".repeat(21), birthDate: "1990-05-20" },
    });

    assert.strictEqual(badDate.statusCode, 400);
    assert.strictEqual(longName.statusCode, 400);
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
    const saved = await testApp.app.inject({
      method: "PUT",
      url: "/profile",
      headers,
      payload: { name: "Ana", birthDate: "1990-05-20", photoPath: path },
    });

    assert.strictEqual(upload.statusCode, 200);
    assert.match(path, new RegExp(`^${userId}/[0-9a-f-]{36}\\.png$`));
    assert.strictEqual(uploadUrl, `https://storage.example.com/upload/${path}`);
    assert.strictEqual(token, "upload-token");
    assert.strictEqual(saved.json().photoUrl, `https://storage.example.com/public/${path}`);
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

  it("refuses a photo that was uploaded to another user's folder", async () => {
    const { headers } = await testApp.signIn();

    const response = await testApp.app.inject({
      method: "PUT",
      url: "/profile",
      headers,
      payload: { name: "Ana", birthDate: "1990-05-20", photoPath: `${randomUUID()}/${randomUUID()}.png` },
    });

    assert.strictEqual(response.statusCode, 422);
    assert.strictEqual(response.json().code, "photoNotOwned");
  });

  it("never exposes fields outside the contract", async () => {
    const { headers } = await testApp.signIn();

    const response = await testApp.app.inject({ method: "GET", url: "/profile", headers });

    assert.deepStrictEqual(Object.keys(response.json()).sort(), ["birthDate", "complete", "email", "id", "name", "photoUrl"]);
  });
});
