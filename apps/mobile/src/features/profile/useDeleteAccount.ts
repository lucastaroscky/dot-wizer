import { useMutation } from "@tanstack/react-query";
import { deleteAccount } from "@/shared/api/profile";
import { supabase } from "@/shared/supabase/client";

async function deleteAndSignOut() {
  await deleteAccount();
  await supabase.auth.signOut();
}

export function useDeleteAccount() {
  const mutation = useMutation({ mutationFn: deleteAndSignOut });

  return {
    remove: () => mutation.mutate(),
    pending: mutation.isPending,
    error: mutation.error?.message ?? "",
    reset: () => mutation.reset(),
  };
}
