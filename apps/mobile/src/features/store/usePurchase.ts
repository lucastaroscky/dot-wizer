import { useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { randomUUID } from "expo-crypto";
import { buyChips } from "@/shared/api/store";
import { walletQueryOptions } from "@/shared/api/wallet";

type Attempt = { quantity: number; idempotencyKey: string };

export function usePurchase() {
  const queryClient = useQueryClient();
  const attempt = useRef<Attempt>(undefined);

  function keyFor(quantity: number) {
    if (attempt.current?.quantity !== quantity) {
      attempt.current = { quantity, idempotencyKey: randomUUID() };
    }
    return attempt.current.idempotencyKey;
  }

  const mutation = useMutation({
    mutationFn: (quantity: number) => buyChips({ quantity, idempotencyKey: keyFor(quantity) }),
    onSuccess: () => {
      attempt.current = undefined;
    },
    onSettled: () => queryClient.invalidateQueries(walletQueryOptions()),
  });

  return {
    buy: (quantity: number) => mutation.mutate(quantity),
    pending: mutation.isPending,
    error: mutation.error?.message ?? "",
  };
}

export type Purchase = ReturnType<typeof usePurchase>;
