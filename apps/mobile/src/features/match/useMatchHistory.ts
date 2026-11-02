import { useQuery } from "@tanstack/react-query";
import { matchHistoryQueryOptions } from "@/shared/api/matches";

const POLL_INTERVAL_MS = 1_000;

export function useMatchHistory({ matchId }: { matchId: string }) {
  const query = useQuery({
    ...matchHistoryQueryOptions({ matchId }),
    enabled: matchId !== "",
    refetchInterval: ({ state }) => (state.data?.status === "IN_PROGRESS" ? POLL_INTERVAL_MS : false),
  });

  return { history: query.data, failed: query.isError };
}
