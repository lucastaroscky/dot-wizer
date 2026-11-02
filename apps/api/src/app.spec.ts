import assert from "node:assert";
import errors from "./common/messages/errors.json" with { type: "json" };
import { createTestApp, TEST_ORIGIN } from "../test/support/test-app.ts";
import type { TestApp } from "../test/support/test-app.ts";

describe("app", () => {
  describe("CORS", () => {
    let testApp: TestApp;

    before(async () => {
      testApp = await createTestApp();
    });
    after(async () => testApp.app.close());

    it("allows the configured origin", async () => {
      const response = await testApp.app.inject({ method: "GET", url: "/wallet", headers: { origin: TEST_ORIGIN } });

      assert.strictEqual(response.headers["access-control-allow-origin"], TEST_ORIGIN);
    });

    it("does not allow any other origin", async () => {
      const response = await testApp.app.inject({
        method: "GET",
        url: "/wallet",
        headers: { origin: "https://evil.example.com" },
      });

      assert.strictEqual(response.headers["access-control-allow-origin"], undefined);
    });

    it("answers the preflight of the configured origin", async () => {
      const response = await testApp.app.inject({
        method: "OPTIONS",
        url: "/profile",
        headers: { origin: TEST_ORIGIN, "access-control-request-method": "PUT", "access-control-request-headers": "authorization,content-type" },
      });

      assert.strictEqual(response.statusCode, 204);
      assert.strictEqual(response.headers["access-control-allow-origin"], TEST_ORIGIN);
    });

    it("answers an unknown route with the fixed error envelope", async () => {
      const response = await testApp.app.inject({ method: "GET", url: "/nowhere" });

      assert.strictEqual(response.statusCode, 404);
      assert.strictEqual(response.json().message, errors.common.routeNotFound);
    });

    it("answers malformed JSON with 400 in the fixed envelope", async () => {
      const { headers } = await testApp.signIn();

      const response = await testApp.app.inject({
        method: "PUT",
        url: "/profile",
        headers: { ...headers, "content-type": "application/json" },
        payload: "{not json",
      });

      assert.strictEqual(response.statusCode, 400);
      assert.deepStrictEqual(Object.keys(response.json()).sort(), ["error", "message", "path", "statusCode", "timestamp"]);
    });
  });

  describe("rate limit", () => {
    let testApp: TestApp;

    before(async () => {
      testApp = await createTestApp({ RATE_LIMIT_MAX: "3" });
    });
    after(async () => testApp.app.close());

    it("answers 429 in the fixed envelope after too many requests from the same address", async () => {
      const statuses = [];
      let last;
      for (let attempt = 0; attempt < 5; attempt++) {
        last = await testApp.app.inject({ method: "GET", url: "/wallet" });
        statuses.push(last.statusCode);
      }

      assert.deepStrictEqual(statuses, [401, 401, 401, 429, 429]);
      assert.strictEqual(last?.json().message, errors.common.tooManyRequests);
    });

    it("does not limit the game server when it sends the service token", async () => {
      const statuses = [];
      for (let attempt = 0; attempt < 6; attempt++) {
        const response = await testApp.app.inject({
          method: "POST",
          url: "/internal/matches",
          headers: testApp.serviceHeaders,
          payload: {},
        });
        statuses.push(response.statusCode);
      }

      assert.deepStrictEqual(statuses, [400, 400, 400, 400, 400, 400]);
    });
  });
});
