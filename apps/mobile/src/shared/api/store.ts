import { keepPreviousData, queryOptions } from "@tanstack/react-query";
import { IDEMPOTENCY_KEY_HEADER, type BuyBody, type PurchaseResponse, type QuoteResponse } from "@pontinho/api-contract";
import { request } from "./client";

export function quoteQueryOptions({ quantity }: { quantity: number }) {
  return queryOptions({
    queryKey: ["store", "quote", quantity],
    queryFn: () => request<QuoteResponse>(`/store/quote?quantity=${quantity}`),
    placeholderData: keepPreviousData,
  });
}

type PurchaseAttempt = BuyBody & { idempotencyKey: string };

export function buyChips({ quantity, idempotencyKey }: PurchaseAttempt) {
  return request<PurchaseResponse>("/store/purchases", {
    method: "POST",
    body: { quantity },
    headers: { [IDEMPOTENCY_KEY_HEADER]: idempotencyKey },
  });
}
