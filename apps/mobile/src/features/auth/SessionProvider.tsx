import { createContext, use, useEffect, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Session } from "@supabase/supabase-js";
import type { DevLoginResponse } from "@pontinho/api-contract";
import { endDevLogin, useDevLogin } from "@/shared/api/devLogin";
import { supabase } from "@/shared/supabase/client";

type SessionState = { userId: string | null | undefined };

const SessionContext = createContext<SessionState | undefined>(undefined);

function signedInUserId(session: Session | null | undefined, devLogin: DevLoginResponse | undefined) {
  if (devLogin) {
    return devLogin.userId;
  }
  if (session === undefined) {
    return undefined;
  }
  return session?.user.id ?? null;
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null>();
  const devLogin = useDevLogin();

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (event === "SIGNED_OUT") {
        queryClient.clear();
        endDevLogin();
      }
      setSession(nextSession);
    });
    return () => data.subscription.unsubscribe();
  }, [queryClient]);

  return <SessionContext value={{ userId: signedInUserId(session, devLogin) }}>{children}</SessionContext>;
}

export function useSession() {
  const state = use(SessionContext);
  if (!state) {
    throw new Error("useSession precisa estar dentro de SessionProvider");
  }
  return state;
}
