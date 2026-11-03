import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { isAuthApiError, isAuthRetryableFetchError } from "@supabase/supabase-js";
import { clearSessionEnd } from "@/shared/api/sessionEnd";
import { supabase } from "@/shared/supabase/client";
import auth from "@/messages/auth.json";
import errors from "@/messages/errors.json";

export const CODE_LENGTH = 6;
const NETWORK_FAILURE_STATUS = 0;

async function sendEmailCode(email: string) {
  const { error } = await supabase.auth.signInWithOtp({ email });
  if (error) {
    throw error;
  }
}

async function verifyEmailCode({ email, code }: { email: string; code: string }) {
  const { error } = await supabase.auth.verifyOtp({ email, token: code, type: "email" });
  if (error) {
    throw error;
  }
}

const AUTH_CODE_TEXTS: Record<string, string> = {
  over_email_send_rate_limit: errors.tooManyRequests,
  over_request_rate_limit: errors.tooManyRequests,
  otp_expired: auth.invalidCode,
  email_address_invalid: auth.sendFailed,
};

type AuthTexts = { fallback: string; serverFailure: string };

function authErrorText(error: Error | null, { fallback, serverFailure }: AuthTexts) {
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

const SEND_TEXTS: AuthTexts = { fallback: auth.sendFailed, serverFailure: auth.sendFailed };
const VERIFY_TEXTS: AuthTexts = { fallback: auth.invalidCode, serverFailure: errors.generic };

function loginError({ sendError, verifyError }: { sendError: Error | null; verifyError: Error | null }) {
  return authErrorText(sendError, SEND_TEXTS) || authErrorText(verifyError, VERIFY_TEXTS);
}

export function useEmailLogin() {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const sendCode = useMutation({ mutationFn: sendEmailCode });
  const verifyCode = useMutation({ mutationFn: verifyEmailCode });

  const canRequestCode = email.trim().length > 0 && !sendCode.isPending;
  const canConfirmCode = code.trim().length === CODE_LENGTH && !verifyCode.isPending;

  function requestCode() {
    if (!canRequestCode) {
      return;
    }
    clearSessionEnd();
    sendCode.mutate(email.trim());
  }

  function confirmCode() {
    if (!canConfirmCode) {
      return;
    }
    verifyCode.mutate({ email: email.trim(), code: code.trim() });
  }

  function changeEmail() {
    sendCode.reset();
    verifyCode.reset();
    setCode("");
  }

  return {
    error: loginError({ sendError: sendCode.error, verifyError: verifyCode.error }),
    email,
    setEmail,
    code,
    setCode,
    codeSent: sendCode.isSuccess,
    sending: sendCode.isPending,
    checking: verifyCode.isPending,
    canRequestCode,
    canConfirmCode,
    requestCode,
    confirmCode,
    changeEmail,
  };
}
