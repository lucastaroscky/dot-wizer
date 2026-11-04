import { useSession } from "@/features/auth/SessionProvider";
import { Match } from "@/features/match/Match";

export default function MatchScreen() {
  const { session } = useSession();
  return <Match userId={session?.user.id} />;
}
