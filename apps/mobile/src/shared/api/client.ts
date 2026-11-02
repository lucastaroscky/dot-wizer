import { errorResponseSchema } from "@pontinho/api-contract";
import { API_URL } from "@/shared/config/env";
import { supabase } from "@/shared/supabase/client";
import errors from "@/messages/errors.json";

const SERVER_ERROR_STATUS = 500;

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

type RequestOptions = { method?: "GET" | "POST" | "PUT"; body?: unknown; headers?: Record<string, string> };

function messageText(message: string | string[]) {
  if (Array.isArray(message)) {
    return message.join(" ");
  }
  return message;
}

async function toApiError(response: Response) {
  if (response.status >= SERVER_ERROR_STATUS) {
    return new ApiError(response.status, errors.generic);
  }
  const envelope = errorResponseSchema.safeParse(await response.json().catch(() => undefined));
  if (!envelope.success) {
    return new ApiError(response.status, errors.generic);
  }
  return new ApiError(response.status, messageText(envelope.data.message));
}

export async function getAccessToken() {
  const { data } = await supabase.auth.getSession();
  if (!data.session) {
    throw new ApiError(401, errors.notSignedIn);
  }
  return data.session.access_token;
}

export async function request<Data>(path: string, { method = "GET", body, headers: extraHeaders }: RequestOptions = {}) {
  const headers: Record<string, string> = { ...extraHeaders, Authorization: `Bearer ${await getAccessToken()}` };
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }
  const response = await fetch(`${API_URL}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) }).catch(() => undefined);
  if (!response) {
    throw new ApiError(0, errors.generic);
  }
  if (!response.ok) {
    throw await toApiError(response);
  }
  return (await response.json()) as Data;
}
