import { keepPreviousData, queryOptions } from "@tanstack/react-query";
import type { BuyBody, PurchaseResponse, QuoteResponse } from "@pontinho/api-contract";
import { request } from "./client";

export function quoteQueryOptions({ quantity }: { quantity: number }) {
  return queryOptions({
    queryKey: ["store", "quote", quantity],
    queryFn: () => request<QuoteResponse>(`/store/quote?quantity=${quantity}`),
    placeholderData: keepPreviousData,
  });
}

export function buyChips(body: BuyBody) {
  return request<PurchaseResponse>("/store/purchases", { method: "POST", body });
}
