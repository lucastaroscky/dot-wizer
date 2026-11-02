import { Redirect, router } from "expo-router";
import { PreRoom } from "@/features/lobby/PreRoom";
import { useMatch } from "@/features/match/MatchProvider";
import { useWallet } from "@/features/wallet/useWallet";
import { MenuScreen } from "@/shared/ui/MenuScreen";
import home from "@/messages/home.json";

export default function Lobby() {
  const { room, connecting, error, join } = useMatch();
  const { balance } = useWallet();

  if (room) {
    return <Redirect href="/match" />;
  }

  return (
    <MenuScreen title={home.title} error={error}>
      <PreRoom balance={balance} connecting={connecting} onConfirm={join} onBack={() => router.back()} />
    </MenuScreen>
  );
}
