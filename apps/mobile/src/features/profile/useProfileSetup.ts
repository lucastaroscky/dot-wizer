import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isValidCpf, type ApiErrorCode } from "@pontinho/api-contract";
import { ApiError } from "@/shared/api/client";
import { profileQueryOptions, register } from "@/shared/api/profile";
import { CPF_INPUT_LENGTH, cpfDigits, formatCpf } from "@/shared/format/cpf";
import profileMessages from "@/messages/profile.json";
import { BIRTH_DATE_INPUT_LENGTH, formatBirthDateInput, toBirthDateInput, toIsoDate } from "./birthDate";

const FIELD_ERROR_CODES: ApiErrorCode[] = ["cpfAlreadyRegistered", "underage", "registrationLocked"];

function errorCodeOf(error: Error | null) {
  if (error instanceof ApiError) {
    return error.code;
  }
  return undefined;
}

function typedError({ text, length, left, valid, message }: { text: string; length: number; left: boolean; valid: boolean; message: string }) {
  const typed = text.length > 0 && (left || text.length === length);
  if (typed && !valid) {
    return message;
  }
  return "";
}

export function useProfileSetup() {
  const queryClient = useQueryClient();
  const { data: profile } = useQuery(profileQueryOptions());
  const [fullName, setFullName] = useState("");
  const [cpfText, setCpfText] = useState("");
  const [cpfLeft, setCpfLeft] = useState(false);
  const [birthDateText, setBirthDateText] = useState(() => (profile?.birthDate ? toBirthDateInput(profile.birthDate) : ""));
  const [birthDateLeft, setBirthDateLeft] = useState(false);
  const [nickname, setNickname] = useState(profile?.nickname ?? "");
  const [confirming, setConfirming] = useState(false);
  const save = useMutation({
    mutationFn: register,
    onSuccess: (saved) => queryClient.setQueryData(profileQueryOptions().queryKey, saved),
    onError: (error) => {
      setConfirming(false);
      if (errorCodeOf(error) === "registrationLocked") {
        queryClient.invalidateQueries({ queryKey: profileQueryOptions().queryKey });
      }
    },
  });

  const cpf = cpfDigits(cpfText);
  const cpfValid = isValidCpf(cpf);
  const birthDate = toIsoDate(birthDateText);
  const canSave = fullName.trim().length > 0 && cpfValid && birthDate !== undefined && nickname.trim().length > 0;
  const errorCode = errorCodeOf(save.error);

  function edit(setter: (text: string) => void) {
    return (text: string) => {
      save.reset();
      setter(text);
    };
  }

  function fieldError(code: ApiErrorCode, typed: string) {
    if (errorCode === code && save.error) {
      return save.error.message;
    }
    return typed;
  }

  function submit() {
    if (!canSave || birthDate === undefined) {
      return;
    }
    save.mutate({ fullName: fullName.trim(), cpf, birthDate, nickname: nickname.trim() });
  }

  return {
    fullName,
    changeFullName: edit(setFullName),
    cpfText,
    changeCpf: edit((text) => setCpfText(formatCpf(text))),
    leaveCpf: () => setCpfLeft(true),
    cpfError: fieldError(
      "cpfAlreadyRegistered",
      typedError({ text: cpfText, length: CPF_INPUT_LENGTH, left: cpfLeft, valid: cpfValid, message: profileMessages.invalidCpf }),
    ),
    birthDateText,
    changeBirthDate: edit((text) => setBirthDateText(formatBirthDateInput(text))),
    leaveBirthDate: () => setBirthDateLeft(true),
    birthDateError: fieldError(
      "underage",
      typedError({ text: birthDateText, length: BIRTH_DATE_INPUT_LENGTH, left: birthDateLeft, valid: birthDate !== undefined, message: profileMessages.invalidBirthDate }),
    ),
    nickname,
    changeNickname: edit(setNickname),
    canSave,
    confirming,
    review: () => setConfirming(canSave),
    fix: () => setConfirming(false),
    saving: save.isPending,
    error: save.error && !FIELD_ERROR_CODES.some((code) => code === errorCode) ? save.error.message : "",
    submit,
  };
}
