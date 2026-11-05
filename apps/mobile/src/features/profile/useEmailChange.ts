import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { profileQueryOptions } from "@/shared/api/profile";
import { authErrorText, type AuthTexts } from "@/shared/supabase/authErrors";
import { supabase } from "@/shared/supabase/client";
import { CODE_LENGTH } from "@/shared/ui/CodeField";
import auth from "@/messages/auth.json";
import errors from "@/messages/errors.json";

async function requestEmailChange(email: string) {
  const { error } = await supabase.auth.updateUser({ email });
  if (error) {
    throw error;
  }
}

async function confirmEmailChange({ email, code }: { email: string; code: string }) {
  const { error } = await supabase.auth.verifyOtp({ email, token: code, type: "email_change" });
  if (error) {
    throw error;
  }
}

const SEND_TEXTS: AuthTexts = { fallback: auth.sendFailed, serverFailure: auth.sendFailed };
const VERIFY_TEXTS: AuthTexts = { fallback: auth.invalidCode, serverFailure: errors.generic };

export function useEmailChange({ onChanged }: { onChanged: () => void }) {
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const sendCode = useMutation({ mutationFn: requestEmailChange });
  const verifyCode = useMutation({
    mutationFn: confirmEmailChange,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: profileQueryOptions().queryKey });
      onChanged();
    },
  });

  const canRequestCode = email.trim().length > 0 && !sendCode.isPending;
  const canConfirmCode = code.length === CODE_LENGTH && !verifyCode.isPending;

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
    verifyCode.mutate({ email: email.trim(), code });
  }

  function changeEmail() {
    sendCode.reset();
    verifyCode.reset();
    setCode("");
  }

  function reset() {
    changeEmail();
    setEmail("");
  }

  return {
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
    reset,
    error: authErrorText(sendCode.error, SEND_TEXTS) || authErrorText(verifyCode.error, VERIFY_TEXTS),
  };
}
