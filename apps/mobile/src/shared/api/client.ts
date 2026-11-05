import { isAuthRetryableFetchError } from "@supabase/supabase-js";
import { errorResponseSchema, type ApiErrorCode } from "@pontinho/api-contract";
import { API_URL } from "@/shared/config/env";
import { supabase } from "@/shared/supabase/client";
import { API_ERROR_TEXTS } from "@/messages/apiErrors";
import { currentDevLogin } from "./devLogin";
import errors from "@/messages/errors.json";
import { fetchWithTimeout } from "./fetchWithTimeout";
import { endSession } from "./sessionEnd";

const TOO_MANY_REQUESTS_STATUS = 429;
const NO_CONTENT_STATUS = 204;
const errorCodeSchema = errorResponseSchema.pick({ code: true });

type ApiErrorKind = "response" | "network" | "timeout";

type ApiErrorInput = { statusCode: number; message: string; code?: ApiErrorCode; kind?: ApiErrorKind };

export class ApiError extends Error {
  statusCode: number;
  code?: ApiErrorCode;
  kind: ApiErrorKind;

  constructor({ statusCode, message, code, kind = "response" }: ApiErrorInput) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.kind = kind;
  }
}

type RequestOptions = { method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"; body?: unknown; headers?: Record<string, string> };

async function toApiError(response: Response) {
  const statusCode = response.status;
  const parsed = errorCodeSchema.safeParse(await response.json().catch(() => undefined));
  if (parsed.success) {
    return new ApiError({ statusCode, code: parsed.data.code, message: API_ERROR_TEXTS[parsed.data.code] });
  }
  if (statusCode === TOO_MANY_REQUESTS_STATUS) {
    return new ApiError({ statusCode, message: errors.tooManyRequests });
  }
  return new ApiError({ statusCode, message: errors.generic });
}

function sessionEndReason(code?: ApiErrorCode) {
  if (code === "invalidToken") {
    return "expired";
  }
  if (code === "accountDisabled") {
    return "accountDisabled";
  }
  return undefined;
}

function toUnreachableError(reason: unknown) {
  const timedOut = reason instanceof Error && reason.name === "AbortError";
  return new ApiError({ statusCode: 0, message: errors.unreachable, kind: timedOut ? "timeout" : "network" });
}

export async function getAccessToken() {
  const devLogin = currentDevLogin();
  if (devLogin) {
    return devLogin.accessToken;
  }
  const { data, error } = await supabase.auth.getSession();
  if (isAuthRetryableFetchError(error)) {
    throw new ApiError({ statusCode: 0, message: errors.unreachable, kind: "network" });
  }
  if (!data.session) {
    throw new ApiError({ statusCode: 401, message: errors.notSignedIn });
  }
  return data.session.access_token;
}

export async function request<Data>(path: string, { method = "GET", body, headers: extraHeaders }: RequestOptions = {}) {
  const headers: Record<string, string> = { ...extraHeaders, Authorization: `Bearer ${await getAccessToken()}` };
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }
  const response = await fetchWithTimeout(`${API_URL}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  }).catch((reason: unknown) => {
    throw toUnreachableError(reason);
  });
  if (!response.ok) {
    const error = await toApiError(response);
    const reason = sessionEndReason(error.code);
    if (reason) {
      await endSession(reason);
    }
    throw error;
  }
  if (response.status === NO_CONTENT_STATUS) {
    return undefined as Data;
  }
  return (await response.json()) as Data;
}
