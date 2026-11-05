import { Redirect } from "expo-router";
import { OpenMatchPrompt } from "@/features/lobby/OpenMatchPrompt";
import { TrainingSetup } from "@/features/lobby/TrainingSetup";
import { useMatch } from "@/features/match/MatchProvider";
import { goBackOrHome } from "@/shared/navigation/goBackOrHome";
import { Screen } from "@/shared/ui/Screen";
import { ScreenHeader } from "@/shared/ui/ScreenHeader";
import lobby from "@/messages/lobby.json";

export default function Training() {
  const { room, connecting, error, openMatch, canResume, join, resume, dismissOpenMatch } = useMatch();

  function goBack() {
    dismissOpenMatch();
    goBackOrHome();
  }

  if (room) {
    return <Redirect href="/match" />;
  }

  return (
    <Screen>
      <ScreenHeader title={lobby.trainingTitle} backLabel={lobby.back} onBack={goBack} />
      {openMatch ? (
        <OpenMatchPrompt canResume={canResume} connecting={connecting} error={error} onResume={resume} onBack={goBack} />
      ) : (
        <TrainingSetup connecting={connecting} error={error} onConfirm={join} />
      )}
    </Screen>
  );
}
