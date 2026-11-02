import { API_ERROR_STATUS } from "@pontinho/api-contract";
import type { ApiErrorCode } from "@pontinho/api-contract";
import errorGroups from "../messages/errors.json" with { type: "json" };

export const ERROR_MESSAGES = Object.assign({}, ...Object.values(errorGroups)) as Record<ApiErrorCode, string>;

interface ApiErrorInput {
  code: ApiErrorCode;
  values?: Record<string, string | number>;
}

interface FillValuesInput {
  message: string;
  values: Record<string, string | number>;
}

function fillValues({ message, values }: FillValuesInput): string {
  return Object.entries(values).reduce((text, [key, value]) => text.replaceAll(`{{${key}}}`, String(value)), message);
}

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly statusCode: number;

  constructor({ code, values = {} }: ApiErrorInput) {
    super(fillValues({ message: ERROR_MESSAGES[code], values }));
    this.name = "ApiError";
    this.code = code;
    this.statusCode = API_ERROR_STATUS[code];
  }
}
