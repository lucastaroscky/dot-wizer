import { useSession } from "@/features/auth/SessionProvider";
import { Match } from "@/features/match/Match";

export default function MatchScreen() {
  const { userId } = useSession();
  return <Match userId={userId ?? undefined} />;
}
