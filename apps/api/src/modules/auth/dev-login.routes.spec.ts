import assert from "node:assert";
import { createTestApp } from "../../../test/support/test-app.ts";
import type { TestApp } from "../../../test/support/test-app.ts";
import { testPrisma } from "../../../test/support/test-database.ts";

const DEV_LOGIN_SECRET = "s".repeat(32);

describe("dev login routes", () => {
  let testApp: TestApp;

  before(async () => {
    testApp = await createTestApp({ NODE_ENV: "development", DEV_LOGIN_SECRET });
  });
  after(async () => testApp.app.close());
  beforeEach(async () => testApp.reset());

  it("lists the test accounts", async () => {
    const response = await testApp.app.inject({ method: "GET", url: "/dev/login" });

    assert.strictEqual(response.statusCode, 200);
    assert.deepStrictEqual(response.json(), { accounts: ["qa1", "qa2", "qa3", "qa4"] });
  });

  it("signs a token that the API accepts, and creates the account on the first use", async () => {
    const login = await testApp.app.inject({ method: "POST", url: "/dev/login", payload: { account: "qa2" } });
    const { accessToken, userId } = login.json();

    const profile = await testApp.app.inject({ method: "GET", url: "/profile", headers: { authorization: `Bearer ${accessToken}` } });
    const again = await testApp.app.inject({ method: "POST", url: "/dev/login", payload: { account: "qa2" } });

    assert.strictEqual(login.statusCode, 200);
    assert.strictEqual(profile.statusCode, 200);
    assert.strictEqual(profile.json().id, userId);
    assert.strictEqual(profile.json().email, "qa2@pontinho.test");
    assert.strictEqual(again.json().userId, userId);
    assert.strictEqual(await testPrisma.user.count(), 1);
  });

  it("refuses an account that is not one of the test accounts", async () => {
    const response = await testApp.app.inject({ method: "POST", url: "/dev/login", payload: { account: "admin" } });

    assert.strictEqual(response.statusCode, 400);
  });

  it("does not exist outside development or without the secret", async () => {
    const testEnv = await createTestApp({ DEV_LOGIN_SECRET });
    const withoutSecret = await createTestApp({ NODE_ENV: "development" });

    const inTest = await testEnv.app.inject({ method: "POST", url: "/dev/login", payload: { account: "qa1" } });
    const noSecret = await withoutSecret.app.inject({ method: "POST", url: "/dev/login", payload: { account: "qa1" } });
    await testEnv.app.close();
    await withoutSecret.app.close();

    assert.strictEqual(inTest.statusCode, 404);
    assert.strictEqual(noSecret.statusCode, 404);
  });
});
