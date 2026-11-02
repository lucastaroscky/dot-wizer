import assert from "node:assert";
import { API_ERROR_CODES, API_ERROR_STATUS } from "@pontinho/api-contract";
import errorGroups from "../messages/errors.json" with { type: "json" };
import { ApiError, ERROR_MESSAGES } from "./api-error.ts";

describe("ApiError", () => {
  it("takes the status from the code table", () => {
    const error = new ApiError({ code: "dailyBonusAlreadyClaimed" });

    assert.strictEqual(error.code, "dailyBonusAlreadyClaimed");
    assert.strictEqual(error.statusCode, API_ERROR_STATUS.dailyBonusAlreadyClaimed);
    assert.strictEqual(error.statusCode, 409);
    assert.ok(error instanceof Error);
  });

  it("carries the developer message of the code", () => {
    assert.strictEqual(new ApiError({ code: "matchNotFound" }).message, "Partida não encontrada.");
  });

  it("fills the values of the message", () => {
    const error = new ApiError({ code: "quantityAboveMaximum", values: { maximum: 10_000 } });

    assert.strictEqual(error.message, "A quantidade máxima por compra é 10000 fichas.");
  });

  it("has a message for every code and no message without a code", () => {
    const groupedKeys = Object.values(errorGroups).flatMap((group) => Object.keys(group));

    assert.deepStrictEqual([...groupedKeys].sort(), [...API_ERROR_CODES].sort());
    assert.deepStrictEqual(Object.keys(ERROR_MESSAGES).sort(), [...API_ERROR_CODES].sort());
  });
});
