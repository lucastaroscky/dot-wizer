import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import type { MatchPlayerSummary } from "@pontinho/api-contract";
import { formatChips } from "@/shared/format/numbers";
import { Avatar } from "@/shared/ui/Avatar";
import { Notice } from "@/shared/ui/Notice";
import { colors } from "@/shared/theme/colors";
import match from "@/messages/match.json";
import { ChipsAmount } from "./ChipsAmount";
import { useMatchHistory } from "./useMatchHistory";

const NO_BALANCE = "—";

function finalBalanceOf(player: MatchPlayerSummary) {
  return player.finalBalance === null ? NO_BALANCE : formatChips(player.finalBalance);
}

function statsOf(player: MatchPlayerSummary) {
  return [
    { label: match.history.startBalance, value: formatChips(player.startBalance) },
    { label: match.history.paid, value: formatChips(player.paid) },
    { label: match.history.received, value: formatChips(player.received) },
    { label: match.history.deficit, value: formatChips(player.deficit) },
    { label: match.history.winBonus, value: formatChips(player.winBonus) },
    { label: match.history.finalBalance, value: finalBalanceOf(player) },
  ];
}

type Props = { matchId: string; userId?: string; polling: boolean };

export function MatchHistory({ matchId, userId, polling }: Props) {
  const { history, error } = useMatchHistory({ matchId, polling });

  if (error) {
    return <Notice text={error} tone="danger" />;
  }
  if (!history) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="small" color={colors.muted} />
        <Text style={styles.loadingText}>{match.history.loading}</Text>
      </View>
    );
  }

  const mine = history.players.find((player) => player.userId === userId);
  const others = history.players.filter((player) => player !== mine);

  return (
    <View style={styles.history}>
      {mine && (
        <View style={styles.mine}>
          <View style={styles.row}>
            <Avatar name={mine.name ?? ""} size={34} />
            <Text style={styles.mineName} numberOfLines={1}>
              {mine.name ?? ""}
            </Text>
            <View style={styles.end}>
              <Text style={styles.label}>{match.history.result}</Text>
              <ChipsAmount value={mine.result} style={styles.mineResult} />
            </View>
          </View>
          <View style={styles.stats}>
            {statsOf(mine).map(({ label, value }) => (
              <View key={label} style={styles.stat}>
                <Text style={styles.label}>{label}</Text>
                <Text style={styles.statValue}>{value}</Text>
              </View>
            ))}
          </View>
        </View>
      )}
      {others.map((player) => (
        <View key={player.userId} style={[styles.row, styles.other]}>
          <Avatar name={player.name ?? ""} size={30} />
          <Text style={styles.otherName} numberOfLines={1}>
            {player.name ?? ""}
          </Text>
          <View style={styles.end}>
            <ChipsAmount value={player.result} style={styles.otherResult} />
            <Text style={styles.label}>
              {match.history.finalBalance} {finalBalanceOf(player)}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  history: { gap: 8 },
  loading: { padding: 18, borderRadius: 20, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, flexDirection: "row", alignItems: "center", gap: 10 },
  loadingText: { color: colors.muted, fontSize: 15 },
  mine: { padding: 16, gap: 14, borderRadius: 22, borderWidth: 1, borderColor: colors.lineStrong, backgroundColor: colors.surface },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  mineName: { flex: 1, color: colors.text, fontSize: 15, fontWeight: "600" },
  end: { alignItems: "flex-end" },
  label: { color: colors.muted, fontSize: 11 },
  mineResult: { color: colors.text, fontSize: 22, fontWeight: "600", fontVariant: ["tabular-nums"] },
  stats: { flexDirection: "row", flexWrap: "wrap", rowGap: 10 },
  stat: { width: "33.3%", gap: 2 },
  statValue: { color: colors.text, fontSize: 14, fontWeight: "600", fontVariant: ["tabular-nums"] },
  other: { minHeight: 58, paddingVertical: 8, paddingHorizontal: 14, borderRadius: 18, borderWidth: 1, borderColor: "#1F2623", backgroundColor: colors.plate },
  otherName: { flex: 1, color: colors.text, fontSize: 14, fontWeight: "600" },
  otherResult: { color: colors.text, fontSize: 15, fontWeight: "700", fontVariant: ["tabular-nums"] },
});
