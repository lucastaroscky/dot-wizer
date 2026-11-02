import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/shared/supabase/client";
import auth from "@/messages/auth.json";

export const CODE_LENGTH = 6;

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

function loginError({ sendFailed, codeInvalid }: { sendFailed: boolean; codeInvalid: boolean }) {
  if (sendFailed) {
    return auth.sendFailed;
  }
  if (codeInvalid) {
    return auth.invalidCode;
  }
  return "";
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
    error: loginError({ sendFailed: sendCode.isError, codeInvalid: verifyCode.isError }),
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
