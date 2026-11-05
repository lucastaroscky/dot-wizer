import assert from "node:assert";
import { readFileSync } from "node:fs";
import { loadEnv } from "./env.ts";

const validSource = {
  DATABASE_URL: "postgresql://pontinho:pontinho@localhost:54329/pontinho_test",
  SUPABASE_URL: "https://project.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
  SERVICE_TOKEN: "a".repeat(32),
  PAYMENT_PROVIDER: "test",
};

describe("loadEnv", () => {
  it("applies the defaults", () => {
    const env = loadEnv({ source: validSource });

    assert.strictEqual(env.PORT, 3000);
    assert.strictEqual(env.CHIP_PRICE_CENTS, 100);
    assert.strictEqual(env.MAX_CHIPS_PER_PURCHASE, 200_000);
    assert.strictEqual(env.SUPABASE_AVATAR_BUCKET, "avatars");
    assert.deepStrictEqual(env.CORS_ORIGINS, []);
    assert.strictEqual(env.TRUST_PROXY, false);
  });

  it("reads TRUST_PROXY as a boolean or as a list of trusted proxies", () => {
    assert.strictEqual(loadEnv({ source: { ...validSource, TRUST_PROXY: "true" } }).TRUST_PROXY, true);
    assert.strictEqual(loadEnv({ source: { ...validSource, TRUST_PROXY: "10.0.0.0/8" } }).TRUST_PROXY, "10.0.0.0/8");
  });

  it("splits the allowed origins by comma", () => {
    const env = loadEnv({ source: { ...validSource, CORS_ORIGINS: "http://a.com, http://b.com" } });

    assert.deepStrictEqual(env.CORS_ORIGINS, ["http://a.com", "http://b.com"]);
  });

  it("fails the boot when a required variable is missing", () => {
    const { DATABASE_URL: _removed, ...source } = validSource;

    assert.throws(() => loadEnv({ source }), /DATABASE_URL/);
  });

  it("fails the boot when the service token is too short", () => {
    assert.throws(() => loadEnv({ source: { ...validSource, SERVICE_TOKEN: "short" } }), /SERVICE_TOKEN/);
  });

  it("requires the payment provider to be chosen explicitly", () => {
    const { PAYMENT_PROVIDER: _removed, ...source } = validSource;

    assert.throws(() => loadEnv({ source }), /PAYMENT_PROVIDER/);
  });

  it("refuses the service token that comes written in .env.example", () => {
    const example = readFileSync(new URL("../../../.env.example", import.meta.url), "utf8");
    const exampleToken = example.match(/^SERVICE_TOKEN=(.+)$/m)?.[1];

    assert.ok(exampleToken);
    assert.throws(() => loadEnv({ source: { ...validSource, SERVICE_TOKEN: exampleToken } }), /SERVICE_TOKEN/);
  });

  it("refuses the test payment provider in production", () => {
    assert.throws(
      () => loadEnv({ source: { ...validSource, NODE_ENV: "production" } }),
      /PAYMENT_PROVIDER/,
    );
  });

  it("refuses the test login secret in production", () => {
    assert.throws(
      () => loadEnv({ source: { ...validSource, NODE_ENV: "production", DEV_LOGIN_SECRET: "s".repeat(32) } }),
      /DEV_LOGIN_SECRET/,
    );
  });

  it("accepts the test login secret in development", () => {
    const env = loadEnv({ source: { ...validSource, NODE_ENV: "development", DEV_LOGIN_SECRET: "s".repeat(32) } });

    assert.strictEqual(env.DEV_LOGIN_SECRET, "s".repeat(32));
  });

  it("accepts the test payment provider outside production", () => {
    for (const nodeEnv of ["development", "test"]) {
      const env = loadEnv({ source: { ...validSource, NODE_ENV: nodeEnv } });

      assert.strictEqual(env.PAYMENT_PROVIDER, "test");
    }
  });
});
