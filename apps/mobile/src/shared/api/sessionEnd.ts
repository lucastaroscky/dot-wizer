import { useSyncExternalStore } from "react";
import { supabase } from "@/shared/supabase/client";
import errors from "@/messages/errors.json";

type SessionEndReason = "expired" | "accountDisabled";

const REASON_TEXTS: Record<SessionEndReason, string> = {
  expired: errors.sessionExpired,
  accountDisabled: errors.accountDisabled,
};

const listeners = new Set<() => void>();
let currentReason: SessionEndReason | undefined;

function setReason(reason: SessionEndReason | undefined) {
  currentReason = reason;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export async function endSession(reason: SessionEndReason) {
  setReason(reason);
  await supabase.auth.signOut({ scope: "local" });
}

export function clearSessionEnd() {
  setReason(undefined);
}

export function useSessionEndText() {
  const reason = useSyncExternalStore(subscribe, () => currentReason, () => undefined);
  if (!reason) {
    return "";
  }
  return REASON_TEXTS[reason];
}
