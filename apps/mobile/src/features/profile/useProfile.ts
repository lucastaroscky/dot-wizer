import { useQuery } from "@tanstack/react-query";
import { profileQueryOptions } from "@/shared/api/profile";

export function useProfile({ signedIn }: { signedIn: boolean }) {
  const query = useQuery({ ...profileQueryOptions(), enabled: signedIn });

  return {
    profile: query.data,
    loading: query.isLoading,
    failed: query.isError,
    retry: () => query.refetch(),
  };
}
