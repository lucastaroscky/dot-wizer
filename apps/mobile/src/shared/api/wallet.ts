import { queryOptions } from "@tanstack/react-query";
import type { DailyBonusResponse, WalletResponse } from "@pontinho/api-contract";
import { request } from "./client";

export function walletQueryOptions() {
  return queryOptions({
    queryKey: ["wallet"],
    queryFn: () => request<WalletResponse>("/wallet"),
  });
}

export function claimDailyBonus() {
  return request<DailyBonusResponse>("/wallet/daily-bonus", { method: "POST" });
}
