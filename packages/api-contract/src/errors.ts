import { z } from "zod";

export const API_ERROR_STATUS = {
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
} as const;

export type ApiErrorCode = keyof typeof API_ERROR_STATUS;

export const API_ERROR_CODES = Object.keys(API_ERROR_STATUS) as ApiErrorCode[];

export const apiErrorCodeSchema = z.enum(API_ERROR_CODES as [ApiErrorCode, ...ApiErrorCode[]]);

export const errorResponseSchema = z.object({
  statusCode: z.number().int().describe("Status HTTP da resposta."),
  code: apiErrorCodeSchema.describe("Identificador estável do erro. O app e o jogo traduzem por ele."),
  message: z
    .union([z.string(), z.array(z.string())])
    .describe("Texto de desenvolvedor, para log. No `validationFailed` é a lista de campos inválidos."),
});
export type ErrorResponse = z.infer<typeof errorResponseSchema>;
