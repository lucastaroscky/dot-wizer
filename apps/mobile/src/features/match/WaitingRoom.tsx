import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { PlayerPlate } from "./PlayerPlate";
import { colors } from "@/shared/theme/colors";
import match from "@/messages/match.json";
import type { GameState } from "./state";

export function WaitingRoom({ state }: { state: GameState }) {
  const status = match.waiting.replace("{count}", String(state.order.length)).replace("{seats}", String(state.seats));

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.status}>{status}</Text>
      <View style={styles.players}>
        {state.order.map((sessionId) => (
          <PlayerPlate key={sessionId} name={state.players[sessionId]?.name ?? ""} />
        ))}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", gap: 24 },
  status: { color: colors.cream, fontSize: 18 },
  players: { gap: 8 },
});
