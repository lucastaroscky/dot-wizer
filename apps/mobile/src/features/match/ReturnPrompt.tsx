import { StyleSheet, Text, View } from "react-native";
import type { Room } from "@colyseus/sdk";
import type { PontinhoState } from "@pontinho/protocol";
import { WoodButton } from "@/shared/ui/WoodButton";
import { colors } from "@/shared/theme/colors";
import match from "@/messages/match.json";
import { sendAction } from "./messaging";
import type { GameState } from "./state";
import { TurnTimer } from "./TurnTimer";

type Props = { room: Room<PontinhoState>; state: GameState };

export function ReturnPrompt({ room, state }: Props) {
  return (
    <View style={styles.prompt}>
      <Text style={styles.title}>{match.returnPrompt.title}</Text>
      <View style={styles.actions}>
        <WoodButton title={match.returnPrompt.back} onPress={() => sendAction(room, "chooseReturn", { back: true })} large />
        <WoodButton title={match.returnPrompt.leave} onPress={() => sendAction(room, "chooseReturn", { back: false })} />
      </View>
      <TurnTimer duration={state.returnDuration} turnNumber={state.returnNumber} />
    </View>
  );
}

const styles = StyleSheet.create({
  prompt: { backgroundColor: "rgba(40, 14, 2, 0.18)", borderRadius: 12, padding: 14, gap: 10, alignItems: "center" },
  title: { color: colors.woodText, fontSize: 18, fontWeight: "700", textAlign: "center" },
  actions: { alignItems: "center", gap: 10 },
});
