import { API_ERROR_STATUS, errorResponseSchema } from "@pontinho/api-contract";
import type { ApiErrorCode } from "@pontinho/api-contract";

export const TAGS = {
  profile: "Perfil",
  wallet: "Carteira",
  store: "Loja",
  matches: "Partidas",
  internal: "Interno (servidor do jogo)",
} as const;

export const APP_SECURITY = [{ bearerAuth: [] }];
export const INTERNAL_SECURITY = [{ serviceToken: [] }];

const APP_COMMON_CODES: ApiErrorCode[] = ["invalidToken", "accountDisabled", "tooManyRequests", "internalError"];
const INTERNAL_COMMON_CODES: ApiErrorCode[] = ["serviceTokenInvalid", "tooManyRequests", "internalError"];

interface ErrorsInput {
  codes?: ApiErrorCode[];
}

interface ErrorResponsesInput {
  codes: ApiErrorCode[];
}

function errorResponses({ codes }: ErrorResponsesInput) {
  const codesByStatus = new Map<number, ApiErrorCode[]>();
  for (const code of codes) {
    const status = API_ERROR_STATUS[code];
    codesByStatus.set(status, [...(codesByStatus.get(status) ?? []), code]);
  }
  return Object.fromEntries(
    [...codesByStatus].map(([status, group]) => [status, errorResponseSchema.describe(`Códigos: ${group.join(", ")}`)]),
  );
}

export function appErrors({ codes = [] }: ErrorsInput = {}) {
  return errorResponses({ codes: [...APP_COMMON_CODES, ...codes] });
}

export function internalErrors({ codes = [] }: ErrorsInput = {}) {
  return errorResponses({ codes: [...INTERNAL_COMMON_CODES, ...codes] });
}
