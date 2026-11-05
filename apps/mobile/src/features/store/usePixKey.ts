import { useMutation, useQueryClient } from "@tanstack/react-query";
import { profileQueryOptions, registerPixKey } from "@/shared/api/profile";

export function usePixKey({ onRegistered }: { onRegistered: () => void }) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: registerPixKey,
    onSuccess: (profile) => {
      queryClient.setQueryData(profileQueryOptions().queryKey, profile);
      onRegistered();
    },
  });

  return {
    register: () => mutation.mutate(),
    pending: mutation.isPending,
    error: mutation.error?.message ?? "",
  };
}
