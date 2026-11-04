import { useQuery } from "@tanstack/react-query";
import { useIsFocused } from "expo-router";
import { walletQueryOptions } from "@/shared/api/wallet";

export function useWallet() {
  const isFocused = useIsFocused();
  const query = useQuery({ ...walletQueryOptions(), subscribed: isFocused });

  return {
    balance: query.data?.balance,
    dailyBonusAvailable: query.data?.dailyBonusAvailable,
    error: query.error?.message ?? "",
    retry: () => query.refetch(),
  };
}
