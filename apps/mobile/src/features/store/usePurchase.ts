import { useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { randomUUID } from "expo-crypto";
import { ApiError } from "@/shared/api/client";
import { buyChips } from "@/shared/api/store";
import { walletQueryOptions } from "@/shared/api/wallet";
import errors from "@/messages/errors.json";

type Attempt = { quantity: number; idempotencyKey: string };

function purchaseError(error: Error | null) {
  if (!error) {
    return "";
  }
  if (error instanceof ApiError && error.kind === "timeout") {
    return errors.purchaseUnconfirmed;
  }
  return error.message;
}

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
    purchasedQuantity: mutation.data?.status === "PAID" ? mutation.data.quantity : undefined,
    clear: () => mutation.reset(),
    error: purchaseError(mutation.error),
  };
}

export type Purchase = ReturnType<typeof usePurchase>;
