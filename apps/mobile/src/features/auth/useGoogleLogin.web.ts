import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/shared/supabase/client";
import auth from "@/messages/auth.json";
import type { GoogleLogin } from "./GoogleLogin";

async function signInWithGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: window.location.origin },
  });
  if (error) {
    throw error;
  }
}

export function useGoogleLogin(): GoogleLogin {
  const signIn = useMutation({ mutationFn: signInWithGoogle });

  return {
    pending: signIn.isPending,
    error: signIn.isError ? auth.googleFailed : "",
    signIn: () => signIn.mutate(),
  };
}
