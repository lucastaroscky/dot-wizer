import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { PlayerPlate } from "../table/PlayerPlate";
import { colors } from "../table/colors";
import type { GameState } from "../table/Table";

export function WaitingRoom({ state }: { state: GameState }) {
  const status = `Aguardando jogadores (${state.order.length} de ${state.seats})`;

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
