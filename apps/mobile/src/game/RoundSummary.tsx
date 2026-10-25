import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Avatar } from "../ui/Avatar";
import { WoodButton } from "../ui/WoodButton";
import { colors } from "../table/colors";
import type { GameState } from "../table/Table";

type Props = { state: GameState; onExit: () => void };

type Row = { sessionId: string; name: string; points: number; roundPoints: number; eliminated: boolean; position: number };

function ranking(state: GameState) {
  const players = state.order.map((sessionId) => {
    const player = state.players[sessionId];
    return {
      sessionId,
      name: player?.name ?? "",
      points: player?.points ?? 0,
      roundPoints: player?.roundPoints ?? 0,
      eliminated: player?.eliminated ?? false,
    };
  });
  const sorted = players.sort((a, b) => Number(a.eliminated) - Number(b.eliminated) || a.points - b.points);

  return sorted.reduce<Row[]>((rows, player, index) => {
    const previous = rows[index - 1];
    const tied = previous && previous.points === player.points && previous.eliminated === player.eliminated;
    return [...rows, { ...player, position: tied ? previous.position : index + 1 }];
  }, []);
}

export function RoundSummary({ state, onExit }: Props) {
  const matchOver = state.phase === "ended";
  const playingWithBots = Object.values(state.players).some((player) => player.bot);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.board}>
        <Text style={styles.title}>{state.announcement}</Text>
        <View style={styles.header}>
          <Text style={[styles.headerText, styles.position]}>#</Text>
          <Text style={[styles.headerText, styles.name]}>Jogador</Text>
          <Text style={[styles.headerText, styles.number]}>Rodada</Text>
          <Text style={[styles.headerText, styles.number]}>Total</Text>
        </View>
        {ranking(state).map((row) => (
          <View key={row.sessionId} style={[styles.row, row.sessionId === state.wentOut && styles.wentOutRow]}>
            <Text style={[styles.cell, styles.position]}>{row.position}º</Text>
            <View style={[styles.name, styles.player]}>
              <Avatar name={row.name} size={28} />
              <View>
                <Text style={styles.cell} numberOfLines={1}>{row.name}</Text>
                {row.sessionId === state.wentOut && <Text style={styles.badge}>Bateu</Text>}
                {row.eliminated && <Text style={styles.eliminated}>Eliminado</Text>}
              </View>
            </View>
            <Text style={[styles.cell, styles.number]}>+{row.roundPoints}</Text>
            <Text style={[styles.cell, styles.number, styles.total]}>{row.points}</Text>
          </View>
        ))}
        {!matchOver && <Text style={styles.next}>Próxima rodada em instantes</Text>}
        {(matchOver || playingWithBots) && (
          <View style={styles.exit}>
            <WoodButton title="Voltar" onPress={onExit} />
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  board: { backgroundImage: colors.woodGradient, borderWidth: 4, borderColor: colors.woodDark, borderRadius: 16, padding: 20, gap: 8, width: "100%", maxWidth: 520 },
  title: { color: colors.woodText, fontSize: 22, fontWeight: "600", textAlign: "center", marginBottom: 8 },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 10 },
  headerText: { color: colors.woodText, fontSize: 13, fontWeight: "700", opacity: 0.7 },
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 8, paddingHorizontal: 10, borderRadius: 10, backgroundColor: "rgba(40, 14, 2, 0.12)" },
  wentOutRow: { backgroundColor: "rgba(242, 201, 76, 0.55)", borderWidth: 2, borderColor: colors.highlight },
  position: { width: 36 },
  name: { flex: 1 },
  player: { flexDirection: "row", alignItems: "center", gap: 8 },
  number: { width: 64, textAlign: "right" },
  cell: { color: colors.woodText, fontSize: 16, fontWeight: "600" },
  total: { fontWeight: "800" },
  badge: { color: colors.woodDark, fontSize: 12, fontWeight: "800" },
  eliminated: { color: colors.red, fontSize: 12, fontWeight: "700" },
  next: { color: colors.woodText, fontSize: 14, textAlign: "center", marginTop: 8 },
  exit: { alignItems: "center", marginTop: 8 },
});
