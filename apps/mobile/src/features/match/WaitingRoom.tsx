import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CHIP_TABLES } from "@pontinho/rules";
import { formatChips } from "@/shared/format/numbers";
import { Avatar } from "@/shared/ui/Avatar";
import { Button } from "@/shared/ui/Button";
import { colors } from "@/shared/theme/colors";
import lobby from "@/messages/lobby.json";
import match from "@/messages/match.json";
import { isOffline, type GameState } from "./state";
import { TurnTimer } from "./TurnTimer";

function tableTitle(tableId: number) {
  const table = CHIP_TABLES.find(({ id }) => id === tableId);
  if (!table) {
    return lobby.trainingHint;
  }
  return `${lobby.tableName.replace("{id}", String(table.id))} · ${lobby.pointValue.replace("{value}", formatChips(table.pointValue))}`;
}

type Props = { state: GameState; onExit: () => void };

export function WaitingRoom({ state, onExit }: Props) {
  const status = match.waiting.replace("{count}", String(state.order.length)).replace("{seats}", String(state.seats));
  const freeSeats = Array.from({ length: Math.max(state.seats - state.order.length, 0) }, (_, index) => index);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.center}>
        <Text style={styles.table}>{tableTitle(state.table)}</Text>
        <View style={styles.status}>
          <ActivityIndicator size="small" color={colors.action} />
          <Text style={styles.statusText}>{status}</Text>
        </View>
        {state.countdownDuration > 0 && (
          <View style={styles.countdown}>
            <TurnTimer duration={state.countdownDuration} turnNumber={state.countdownNumber} />
          </View>
        )}
        <View style={styles.seats}>
          {state.order.map((sessionId) => {
            const player = state.players[sessionId];
            return (
              <View key={sessionId} style={styles.seat}>
                <Avatar name={player?.name ?? ""} size={32} photoUrl={player?.photoUrl} />
                <View style={styles.seatText}>
                  <Text style={styles.name} numberOfLines={1}>
                    {player?.name ?? ""}
                  </Text>
                  {isOffline(player) && <Text style={styles.offline}>{match.offline}</Text>}
                </View>
              </View>
            );
          })}
          {freeSeats.map((index) => (
            <View key={index} style={[styles.seat, styles.freeSeat]} aria-hidden />
          ))}
        </View>
      </View>
      <Button title={match.exit} onPress={onExit} variant="secondary" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, width: "100%", maxWidth: 480, alignSelf: "center", paddingHorizontal: 20, paddingBottom: 28 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 28 },
  table: { color: "#A9C9B5", fontSize: 13, fontWeight: "600" },
  status: { flexDirection: "row", alignItems: "center", gap: 10 },
  statusText: { color: colors.text, fontSize: 18, fontWeight: "600" },
  countdown: { width: 220 },
  seats: { alignSelf: "stretch", flexDirection: "row", flexWrap: "wrap", gap: 10 },
  seat: { width: "48.5%", height: 60, paddingHorizontal: 12, borderRadius: 14, borderWidth: 1, borderColor: colors.line, backgroundColor: "#0E1512", flexDirection: "row", alignItems: "center", gap: 10 },
  freeSeat: { borderStyle: "dashed", borderColor: colors.lineStrong, backgroundColor: "transparent" },
  seatText: { flex: 1 },
  name: { color: colors.text, fontSize: 14, fontWeight: "600" },
  offline: { color: colors.errorText, fontSize: 11, fontWeight: "600" },
});
