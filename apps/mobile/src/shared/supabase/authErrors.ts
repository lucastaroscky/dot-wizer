import { isAuthApiError, isAuthRetryableFetchError } from "@supabase/supabase-js";
import auth from "@/messages/auth.json";
import errors from "@/messages/errors.json";

const NETWORK_FAILURE_STATUS = 0;

const AUTH_CODE_TEXTS: Record<string, string> = {
  over_email_send_rate_limit: errors.tooManyRequests,
  over_request_rate_limit: errors.tooManyRequests,
  otp_expired: auth.invalidCode,
  email_address_invalid: auth.sendFailed,
  email_exists: auth.emailInUse,
};

export type AuthTexts = { fallback: string; serverFailure: string };

export function authErrorText(error: Error | null, { fallback, serverFailure }: AuthTexts) {
  if (!error) {
    return "";
  }
  if (isAuthRetryableFetchError(error)) {
    return error.status === NETWORK_FAILURE_STATUS ? errors.unreachable : serverFailure;
  }
  if (!isAuthApiError(error) || !error.code) {
    return fallback;
  }
  return AUTH_CODE_TEXTS[error.code] ?? fallback;
}
