import { useQuery } from "@tanstack/react-query";
import { useIsFocused } from "expo-router";
import { walletQueryOptions } from "@/shared/api/wallet";

export function useWallet() {
  const isFocused = useIsFocused();
  const query = useQuery({ ...walletQueryOptions(), subscribed: isFocused });

  return {
    balance: query.data?.balance ?? 0,
    dailyBonusAvailable: query.data?.dailyBonusAvailable ?? false,
    loading: query.isLoading,
    error: query.error?.message ?? "",
  };
}
