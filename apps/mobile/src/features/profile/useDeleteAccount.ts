import { useMutation } from "@tanstack/react-query";
import { ApiError } from "@/shared/api/client";
import { deleteAccount } from "@/shared/api/profile";
import { supabase } from "@/shared/supabase/client";
import errors from "@/messages/errors.json";

async function deleteAndSignOut() {
  await deleteAccount();
  await supabase.auth.signOut();
}

function deleteError(error: Error | null) {
  if (!error) {
    return "";
  }
  if (error instanceof ApiError) {
    return error.message;
  }
  return errors.generic;
}

export function useDeleteAccount() {
  const mutation = useMutation({ mutationFn: deleteAndSignOut });

  return {
    remove: () => mutation.mutate(),
    pending: mutation.isPending,
    error: deleteError(mutation.error),
    reset: () => mutation.reset(),
  };
}
