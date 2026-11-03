import { Redirect } from "expo-router";
import { OpenMatchPrompt } from "@/features/lobby/OpenMatchPrompt";
import { PreRoom } from "@/features/lobby/PreRoom";
import { useMatch } from "@/features/match/MatchProvider";
import { useWallet } from "@/features/wallet/useWallet";
import { goBackOrHome } from "@/shared/navigation/goBackOrHome";
import { MenuScreen } from "@/shared/ui/MenuScreen";
import home from "@/messages/home.json";

export default function Lobby() {
  const { room, connecting, error, openMatch, canResume, join, resume, dismissOpenMatch } = useMatch();
  const { balance } = useWallet();

  function goBack() {
    dismissOpenMatch();
    goBackOrHome();
  }

  if (room) {
    return <Redirect href="/match" />;
  }

  return (
    <MenuScreen title={home.title} error={error}>
      {openMatch ? (
        <OpenMatchPrompt canResume={canResume} connecting={connecting} onResume={resume} onBack={goBack} />
      ) : (
        <PreRoom balance={balance ?? 0} connecting={connecting} onConfirm={join} onBack={goBack} />
      )}
    </MenuScreen>
  );
}
