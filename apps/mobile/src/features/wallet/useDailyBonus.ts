import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/shared/api/client";
import { claimDailyBonus, walletQueryOptions } from "@/shared/api/wallet";

function visibleError(error: Error | null) {
  if (!error) {
    return "";
  }
  if (error instanceof ApiError && error.code === "dailyBonusAlreadyClaimed") {
    return "";
  }
  return error.message;
}

export function useDailyBonus() {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: claimDailyBonus,
    onSettled: () => queryClient.invalidateQueries(walletQueryOptions()),
  });

  return {
    claim: () => mutation.mutate(),
    pending: mutation.isPending,
    error: visibleError(mutation.error),
  };
}
