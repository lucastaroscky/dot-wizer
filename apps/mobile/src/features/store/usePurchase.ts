import { useMutation, useQueryClient } from "@tanstack/react-query";
import { buyChips } from "@/shared/api/store";
import { walletQueryOptions } from "@/shared/api/wallet";

export function usePurchase() {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: buyChips,
    onSettled: () => queryClient.invalidateQueries(walletQueryOptions()),
  });

  return {
    buy: (quantity: number) => mutation.mutate({ quantity }),
    pending: mutation.isPending,
    error: mutation.error?.message ?? "",
  };
}

export type Purchase = ReturnType<typeof usePurchase>;
