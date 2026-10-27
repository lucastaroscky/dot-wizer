import { Redirect, router } from "expo-router";
import { PreRoom } from "@/features/lobby/PreRoom";
import { useMatch } from "@/features/match/MatchProvider";
import { MenuScreen } from "@/shared/ui/MenuScreen";
import home from "@/messages/home.json";

export default function Lobby() {
  const { room, error, join } = useMatch();

  if (room) {
    return <Redirect href="/match" />;
  }

  return (
    <MenuScreen title={home.title} error={error}>
      <PreRoom onConfirm={join} onBack={() => router.back()} />
    </MenuScreen>
  );
}
