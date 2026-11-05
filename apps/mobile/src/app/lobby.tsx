import { Redirect } from "expo-router";
import { OpenMatchPrompt } from "@/features/lobby/OpenMatchPrompt";
import { PreRoom } from "@/features/lobby/PreRoom";
import { useMatch } from "@/features/match/MatchProvider";
import { BalanceCard } from "@/features/wallet/BalanceCard";
import { useWallet } from "@/features/wallet/useWallet";
import { goBackOrHome } from "@/shared/navigation/goBackOrHome";
import { Screen } from "@/shared/ui/Screen";
import { ScreenHeader } from "@/shared/ui/ScreenHeader";
import home from "@/messages/home.json";
import lobby from "@/messages/lobby.json";

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
    <Screen>
      <ScreenHeader title={home.playOnline} backLabel={lobby.back} onBack={goBack}>
        {!openMatch && <BalanceCard balance={balance} />}
      </ScreenHeader>
      {openMatch ? (
        <OpenMatchPrompt canResume={canResume} connecting={connecting} error={error} onResume={resume} onBack={goBack} />
      ) : (
        <PreRoom balance={balance ?? 0} connecting={connecting} error={error} onConfirm={join} />
      )}
    </Screen>
  );
}
