import { queryOptions } from "@tanstack/react-query";
import type { MatchHistoryResponse } from "@pontinho/api-contract";
import { request } from "./client";

export function matchHistoryQueryOptions({ matchId }: { matchId: string }) {
  return queryOptions({
    queryKey: ["matches", matchId],
    queryFn: () => request<MatchHistoryResponse>(`/matches/${matchId}`),
  });
}
