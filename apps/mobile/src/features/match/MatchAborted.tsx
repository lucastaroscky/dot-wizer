import { StyleSheet, View } from "react-native";
import { WoodButton } from "@/shared/ui/WoodButton";
import match from "@/messages/match.json";
import { MatchHistory } from "./MatchHistory";
import { SummaryBoard } from "./SummaryBoard";

type Props = { matchId: string; onExit: () => void };

export function MatchAborted({ matchId, onExit }: Props) {
  return (
    <SummaryBoard title={match.matchAborted}>
      <MatchHistory matchId={matchId} polling={false} />
      <View style={styles.exit}>
        <WoodButton title={match.back} onPress={onExit} />
      </View>
    </SummaryBoard>
  );
}

const styles = StyleSheet.create({
  exit: { alignItems: "center", marginTop: 8 },
});
