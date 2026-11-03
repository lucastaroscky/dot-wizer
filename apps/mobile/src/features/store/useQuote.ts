import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CHIP_PURCHASE_MINIMUM } from "@pontinho/api-contract";
import { quoteQueryOptions } from "@/shared/api/store";

const QUOTE_DELAY_MS = 300;

export function useQuote() {
  const [quantity, setQuantity] = useState(CHIP_PURCHASE_MINIMUM);
  const [quotedQuantity, setQuotedQuantity] = useState(CHIP_PURCHASE_MINIMUM);
  const quoteTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const query = useQuery(quoteQueryOptions({ quantity: quotedQuantity }));
  const lastQuote = query.data;

  const canDecrease = lastQuote !== undefined && quantity - lastQuote.quantityStep >= lastQuote.minimumQuantity;
  const canIncrease = lastQuote !== undefined && quantity + lastQuote.quantityStep <= lastQuote.maximumQuantity;

  function changeQuantity(nextQuantity: number) {
    setQuantity(nextQuantity);
    clearTimeout(quoteTimer.current);
    quoteTimer.current = setTimeout(() => setQuotedQuantity(nextQuantity), QUOTE_DELAY_MS);
  }

  function decrease() {
    if (!lastQuote || !canDecrease) {
      return;
    }
    changeQuantity(quantity - lastQuote.quantityStep);
  }

  function increase() {
    if (!lastQuote || !canIncrease) {
      return;
    }
    changeQuantity(quantity + lastQuote.quantityStep);
  }

  return {
    quantity,
    amountCents: lastQuote && Math.round((lastQuote.amountCents * quantity) / lastQuote.quantity),
    upToDate: lastQuote?.quantity === quantity,
    canDecrease,
    canIncrease,
    decrease,
    increase,
    error: query.error?.message ?? "",
  };
}

export type Quote = ReturnType<typeof useQuote>;
