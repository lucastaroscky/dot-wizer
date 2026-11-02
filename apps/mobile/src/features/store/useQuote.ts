import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CHIP_PURCHASE_MINIMUM } from "@pontinho/api-contract";
import { quoteQueryOptions } from "@/shared/api/store";

export function useQuote() {
  const [quantity, setQuantity] = useState(CHIP_PURCHASE_MINIMUM);
  const query = useQuery(quoteQueryOptions({ quantity }));
  const limits = query.data;

  const canDecrease = limits !== undefined && quantity - limits.quantityStep >= limits.minimumQuantity;
  const canIncrease = limits !== undefined && quantity + limits.quantityStep <= limits.maximumQuantity;

  function decrease() {
    if (!limits || !canDecrease) {
      return;
    }
    setQuantity(quantity - limits.quantityStep);
  }

  function increase() {
    if (!limits || !canIncrease) {
      return;
    }
    setQuantity(quantity + limits.quantityStep);
  }

  return {
    quantity,
    amountCents: limits?.amountCents,
    upToDate: limits !== undefined && !query.isPlaceholderData,
    canDecrease,
    canIncrease,
    decrease,
    increase,
    error: query.error?.message ?? "",
  };
}

export type Quote = ReturnType<typeof useQuote>;
