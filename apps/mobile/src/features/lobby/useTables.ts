import { useQuery } from "@tanstack/react-query";
import { JOIN_REFUSALS, TABLES_PATH, type TablesResponse } from "@pontinho/protocol";
import { getAccessToken } from "@/shared/api/client";
import { fetchWithTimeout } from "@/shared/api/fetchWithTimeout";
import { endSession } from "@/shared/api/sessionEnd";
import { SERVER_URL } from "@/shared/config/env";
import errors from "@/messages/errors.json";

async function fetchTables(): Promise<TablesResponse> {
  const headers = { Authorization: `Bearer ${await getAccessToken()}` };
  const response = await fetchWithTimeout(`${SERVER_URL}${TABLES_PATH}`, { headers }).catch(() => {
    throw new Error(errors.unreachable);
  });
  if (response.status === JOIN_REFUSALS.invalidToken.code) {
    await endSession("expired");
  }
  if (response.status === JOIN_REFUSALS.accountDisabled.code) {
    await endSession("accountDisabled");
  }
  if (!response.ok) {
    throw new Error(errors.generic);
  }
  return response.json();
}

export function useTables() {
  const query = useQuery({ queryKey: ["tables"], queryFn: fetchTables, retry: false });

  return {
    tables: query.data?.tables,
    refreshing: query.isFetching,
    error: query.error?.message ?? "",
    refresh: () => query.refetch(),
  };
}
