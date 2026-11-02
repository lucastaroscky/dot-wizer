import assert from "node:assert";
import { isServiceToken } from "./service-token.ts";

const expected = "s".repeat(40);

describe("isServiceToken", () => {
  it("accepts the configured secret", () => {
    assert.strictEqual(isServiceToken({ provided: expected, expected }), true);
  });

  it("rejects another secret, even one of the same length", () => {
    assert.strictEqual(isServiceToken({ provided: "x".repeat(40), expected }), false);
  });

  it("rejects a secret of another length", () => {
    assert.strictEqual(isServiceToken({ provided: "short", expected }), false);
  });

  it("rejects a missing header", () => {
    assert.strictEqual(isServiceToken({ provided: undefined, expected }), false);
  });

  it("rejects a repeated header", () => {
    assert.strictEqual(isServiceToken({ provided: [expected, expected], expected }), false);
  });
});
