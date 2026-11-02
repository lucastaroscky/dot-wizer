import { StyleSheet, Text, View } from "react-native";
import type { MatchPlayerSummary } from "@pontinho/api-contract";
import { formatChips } from "@/shared/format/numbers";
import { colors } from "@/shared/theme/colors";
import match from "@/messages/match.json";
import { ChipsAmount } from "./ChipsAmount";
import { useMatchHistory } from "./useMatchHistory";

const NO_BALANCE = "—";

function statsOf(player: MatchPlayerSummary) {
  return [
    { label: match.history.startBalance, value: formatChips(player.startBalance) },
    { label: match.history.paid, value: formatChips(player.paid) },
    { label: match.history.received, value: formatChips(player.received) },
    { label: match.history.deficit, value: formatChips(player.deficit) },
    { label: match.history.winBonus, value: formatChips(player.winBonus) },
    { label: match.history.finalBalance, value: player.finalBalance === null ? NO_BALANCE : formatChips(player.finalBalance) },
  ];
}

export function MatchHistory({ matchId, polling = true }: { matchId: string; polling?: boolean }) {
  const { history, error } = useMatchHistory({ matchId, polling });

  if (error) {
    return <Text style={styles.message}>{error}</Text>;
  }
  if (!history) {
    return <Text style={styles.message}>{match.history.loading}</Text>;
  }
  return (
    <View style={styles.history}>
      <Text style={styles.title}>{match.history.title}</Text>
      {history.players.map((player) => (
        <View key={player.userId} style={styles.player}>
          <View style={styles.header}>
            <Text style={styles.name} numberOfLines={1}>
              {player.name ?? ""}
            </Text>
            <Text style={styles.resultLabel}>{match.history.result}</Text>
            <ChipsAmount value={player.result} style={styles.result} />
          </View>
          <View style={styles.stats}>
            {statsOf(player).map(({ label, value }) => (
              <View key={label} style={styles.stat}>
                <Text style={styles.statLabel}>{label}</Text>
                <Text style={styles.statValue}>{value}</Text>
              </View>
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  history: { gap: 8 },
  message: { color: colors.woodText, fontSize: 14, textAlign: "center" },
  title: { color: colors.woodText, fontSize: 18, fontWeight: "700", textAlign: "center" },
  player: { backgroundColor: "rgba(40, 14, 2, 0.12)", borderRadius: 10, padding: 10, gap: 6 },
  header: { flexDirection: "row", alignItems: "center", gap: 6 },
  name: { flex: 1, color: colors.woodText, fontSize: 16, fontWeight: "700" },
  resultLabel: { color: colors.woodText, fontSize: 13, opacity: 0.7 },
  result: { fontSize: 18, fontWeight: "800" },
  stats: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  stat: { minWidth: 76 },
  statLabel: { color: colors.woodText, fontSize: 11, opacity: 0.7 },
  statValue: { color: colors.woodText, fontSize: 14, fontWeight: "600" },
});
