import assert from "node:assert";
import { randomUUID } from "node:crypto";
import { errors as joseErrors } from "jose";
import { SignJWT } from "jose";
import { strangerKey, signTestToken, TEST_ISSUER, testKeySet } from "../../../test/support/test-keys.ts";
import { TokenVerifier } from "./token-verifier.ts";

describe("TokenVerifier", () => {
  const verifier = new TokenVerifier({ keySet: testKeySet, issuer: TEST_ISSUER });

  async function assertRejected(token: string) {
    await assert.rejects(verifier.verify({ token }), (error: { statusCode: number; code: string }) => {
      assert.strictEqual(error.statusCode, 401);
      assert.strictEqual(error.code, "invalidToken");
      return true;
    });
  }

  it("returns the user id and email of a valid token", async () => {
    const userId = randomUUID();
    const token = await signTestToken({ userId, email: "ana@example.com" });

    assert.deepStrictEqual(await verifier.verify({ token }), { userId, email: "ana@example.com" });
  });

  it("rejects an expired token", async () => {
    await assertRejected(await signTestToken({ userId: randomUUID(), expiresIn: "-1h" }));
  });

  it("rejects a token from another issuer", async () => {
    await assertRejected(await signTestToken({ userId: randomUUID(), issuer: "https://evil.example.com/auth/v1" }));
  });

  it("rejects a token for another audience", async () => {
    await assertRejected(await signTestToken({ userId: randomUUID(), audience: "anon" }));
  });

  it("rejects a token signed by an unknown key", async () => {
    await assertRejected(await signTestToken({ userId: randomUUID(), key: strangerKey }));
  });

  it("rejects a token signed with a shared secret", async () => {
    const token = await new SignJWT({ email: "ana@example.com" })
      .setProtectedHeader({ alg: "HS256", kid: "test-key" })
      .setSubject(randomUUID())
      .setIssuer(TEST_ISSUER)
      .setAudience("authenticated")
      .setExpirationTime("1h")
      .sign(new TextEncoder().encode("a".repeat(32)));

    await assertRejected(token);
  });

  it("rejects a token whose subject is not a uuid", async () => {
    await assertRejected(await signTestToken({ userId: "not-a-uuid" }));
  });

  it("rejects a token without email", async () => {
    await assertRejected(await signTestToken({ userId: randomUUID(), email: null }));
  });

  it("rejects text that is not a token", async () => {
    await assertRejected("garbage");
  });

  it("does not call a key server outage an invalid token", async () => {
    const outage = new TokenVerifier({
      keySet: async () => {
        throw new joseErrors.JWKSTimeout();
      },
      issuer: TEST_ISSUER,
    });
    const token = await signTestToken({ userId: randomUUID() });

    await assert.rejects(outage.verify({ token }), joseErrors.JWKSTimeout);
  });
});
