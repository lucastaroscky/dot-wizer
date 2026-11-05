import assert from "node:assert";
import { API_ERROR_CODES, API_ERROR_STATUS, apiErrorCodeSchema, errorResponseSchema } from "../src/index.ts";

const EXPECTED_STATUS: Record<string, number> = {
  invalidToken: 401,
  serviceTokenInvalid: 401,
  accountDisabled: 403,
  validationFailed: 400,
  badRequest: 400,
  routeNotFound: 404,
  tooManyRequests: 429,
  uniqueConflict: 409,
  internalError: 500,
  underage: 422,
  photoNotOwned: 422,
  profileNotFound: 404,
  cpfAlreadyRegistered: 409,
  registrationLocked: 409,
  registrationRequired: 409,
  dailyBonusAlreadyClaimed: 409,
  insufficientBalance: 409,
  quantityAboveMaximum: 422,
  purchaseNotFound: 404,
  idempotencyKeyReused: 409,
  matchNotFound: 404,
  tableNotFound: 422,
  playerNotFound: 404,
  playerBelowMinimumBalance: 409,
  playerAlreadyInMatch: 409,
  playerNotInMatch: 422,
  matchAlreadyFinished: 409,
  roundOutOfOrder: 409,
  winnerEliminated: 422,
  winnerChanged: 409,
};

describe("api errors", () => {
  it("maps every error code to its HTTP status", () => {
    assert.deepStrictEqual({ ...API_ERROR_STATUS }, EXPECTED_STATUS);
  });

  it("has 30 codes", () => {
    assert.strictEqual(API_ERROR_CODES.length, 30);
  });

  it("accepts only known codes", () => {
    assert.strictEqual(apiErrorCodeSchema.safeParse("dailyBonusAlreadyClaimed").success, true);
    assert.strictEqual(apiErrorCodeSchema.safeParse("somethingElse").success, false);
  });

  it("describes the error envelope with the code", () => {
    const envelope = {
      statusCode: 409,
      code: "dailyBonusAlreadyClaimed",
      message: "O bônus de hoje já foi resgatado.",
    };

    assert.deepStrictEqual(errorResponseSchema.parse(envelope), envelope);
    assert.strictEqual(errorResponseSchema.safeParse({ ...envelope, code: "nope" }).success, false);
    assert.strictEqual(errorResponseSchema.safeParse({ ...envelope, code: undefined }).success, false);
  });

  it("accepts the list of problems of a validation failure as message", () => {
    const envelope = {
      statusCode: 400,
      code: "validationFailed",
      message: ["body/name: Too small"],
    };

    assert.deepStrictEqual(errorResponseSchema.parse(envelope), envelope);
  });

  it("is only the status, the code and the message", () => {
    const parsed = errorResponseSchema.parse({
      statusCode: 404,
      code: "matchNotFound",
      message: "Partida não encontrada.",
      error: "Not Found",
      path: "/matches/x",
      timestamp: "2026-11-02T15:00:00.000Z",
    });

    assert.deepStrictEqual(Object.keys(parsed).sort(), ["code", "message", "statusCode"]);
  });
});
