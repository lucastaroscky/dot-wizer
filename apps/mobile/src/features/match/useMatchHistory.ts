import { useQuery } from "@tanstack/react-query";
import { ApiError } from "@/shared/api/client";
import { matchHistoryQueryOptions } from "@/shared/api/matches";
import match from "@/messages/match.json";

const POLL_INTERVAL_MS = 1_000;

function historyError(error: Error | null) {
  if (!error) {
    return "";
  }
  if (error instanceof ApiError && error.code === "matchNotFound") {
    return error.message;
  }
  return match.history.loadFailed;
}

export function useMatchHistory({ matchId, polling }: { matchId: string; polling: boolean }) {
  const query = useQuery({
    ...matchHistoryQueryOptions({ matchId }),
    enabled: matchId !== "",
    refetchInterval: ({ state }) => (polling && state.data?.status === "IN_PROGRESS" ? POLL_INTERVAL_MS : false),
  });

  return { history: query.data, error: historyError(query.error) };
}
