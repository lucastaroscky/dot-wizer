import { useMutation, useQueryClient } from "@tanstack/react-query";
import { claimDailyBonus, walletQueryOptions } from "@/shared/api/wallet";

export function useDailyBonus() {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: claimDailyBonus,
    onSettled: () => queryClient.invalidateQueries(walletQueryOptions()),
  });

  return {
    claim: () => mutation.mutate(),
    pending: mutation.isPending,
    error: mutation.error?.message ?? "",
  };
}
