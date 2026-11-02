import assert from "node:assert";
import { isAdult } from "./adulthood.ts";

describe("isAdult", () => {
  it("is true on the 18th birthday", () => {
    assert.strictEqual(isAdult({ birthDate: "2008-11-02", today: "2026-11-02" }), true);
  });

  it("is false the day before the 18th birthday", () => {
    assert.strictEqual(isAdult({ birthDate: "2008-11-03", today: "2026-11-02" }), false);
  });

  it("is true for someone older", () => {
    assert.strictEqual(isAdult({ birthDate: "1990-05-20", today: "2026-11-02" }), true);
  });

  it("is false for someone who turns 18 later in the year", () => {
    assert.strictEqual(isAdult({ birthDate: "2008-12-31", today: "2026-11-02" }), false);
  });

  it("is false for a birth date in the future", () => {
    assert.strictEqual(isAdult({ birthDate: "2030-01-01", today: "2026-11-02" }), false);
  });

  it("counts a leap day birthday from March 1st in a common year", () => {
    assert.strictEqual(isAdult({ birthDate: "2008-02-29", today: "2026-02-28" }), false);
    assert.strictEqual(isAdult({ birthDate: "2008-02-29", today: "2026-03-01" }), true);
  });
});
