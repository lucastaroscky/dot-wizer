import { StyleSheet, Text, View } from "react-native";
import type { Room } from "@colyseus/sdk";
import type { PontinhoState } from "@pontinho/protocol";
import { returnPoints } from "@pontinho/rules";
import { Button } from "@/shared/ui/Button";
import { colors } from "@/shared/theme/colors";
import { fonts } from "@/shared/theme/fonts";
import match from "@/messages/match.json";
import { sendAction } from "./messaging";
import type { GameState } from "./state";
import { TurnTimer } from "./TurnTimer";

type Props = { room: Room<PontinhoState>; state: GameState };

export function ReturnPrompt({ room, state }: Props) {
  return (
    <View style={styles.prompt}>
      <Text style={styles.title}>{match.returnPrompt.title}</Text>
      <Text style={styles.detail}>{match.returnPrompt.returnsWith.replace("{points}", String(returnPoints(Object.values(state.players))))}</Text>
      <View style={styles.actions}>
        <View style={styles.action}>
          <Button title={match.returnPrompt.back} onPress={() => sendAction(room, "chooseReturn", { back: true })} />
        </View>
        <View style={styles.action}>
          <Button title={match.returnPrompt.leave} onPress={() => sendAction(room, "chooseReturn", { back: false })} variant="secondary" />
        </View>
      </View>
      <TurnTimer duration={state.returnDuration} turnNumber={state.returnNumber} />
    </View>
  );
}

const styles = StyleSheet.create({
  prompt: { paddingVertical: 18, paddingHorizontal: 16, gap: 12, borderRadius: 24, borderWidth: 1, borderColor: colors.action, backgroundColor: colors.surface },
  title: { color: colors.text, fontSize: 18, fontFamily: fonts.display },
  detail: { marginTop: -4, color: colors.muted, fontSize: 14, fontFamily: fonts.regular },
  actions: { flexDirection: "row", gap: 10 },
  action: { flex: 1 },
});
