import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/shared/supabase/client";
import errors from "@/messages/errors.json";

async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) {
    throw error;
  }
}

export function useSignOut() {
  const mutation = useMutation({ mutationFn: signOut });

  return {
    signOut: () => mutation.mutate(),
    pending: mutation.isPending,
    error: mutation.isError ? errors.generic : "",
  };
}
