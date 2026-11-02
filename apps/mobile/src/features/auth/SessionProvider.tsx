import { createContext, use, useEffect, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/shared/supabase/client";

type SessionState = { session: Session | null | undefined };

const SessionContext = createContext<SessionState | undefined>(undefined);

export function SessionProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null>();

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (event === "SIGNED_OUT") {
        queryClient.clear();
      }
      setSession(nextSession);
    });
    return () => data.subscription.unsubscribe();
  }, [queryClient]);

  return <SessionContext value={{ session }}>{children}</SessionContext>;
}

export function useSession() {
  const state = use(SessionContext);
  if (!state) {
    throw new Error("useSession precisa estar dentro de SessionProvider");
  }
  return state;
}
