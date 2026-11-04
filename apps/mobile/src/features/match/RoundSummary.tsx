import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { Room } from "@colyseus/sdk";
import type { PontinhoState } from "@pontinho/protocol";
import { Avatar } from "@/shared/ui/Avatar";
import { colors } from "@/shared/theme/colors";
import { fonts } from "@/shared/theme/fonts";
import match from "@/messages/match.json";
import { ChipsAmount } from "./ChipsAmount";
import { ExitButton } from "./ExitButton";
import { MatchEnd } from "./MatchEnd";
import { ReturnPrompt } from "./ReturnPrompt";
import { announcementText, hasChips, isSittingOut, needsExitConfirmation, tableTitle, type GameState } from "./state";

type Props = { room: Room<PontinhoState>; state: GameState; userId?: string; onExit: () => void };

type Row = {
  sessionId: string;
  name: string;
  photoUrl: string;
  points: number;
  roundPoints: number;
  roundChips: number;
  eliminated: boolean;
  sittingOut: boolean;
  awaitingReturn: boolean;
  position: number;
};

function ranking(state: GameState) {
  const players = state.order.map((sessionId) => {
    const player = state.players[sessionId];
    return {
      sessionId,
      name: player?.name ?? "",
      photoUrl: player?.photoUrl ?? "",
      points: player?.points ?? 0,
      roundPoints: player?.roundPoints ?? 0,
      roundChips: player?.roundChips ?? 0,
      eliminated: player?.eliminated ?? false,
      sittingOut: isSittingOut(player),
      awaitingReturn: player?.awaitingReturn ?? false,
    };
  });
  const sorted = players.sort((a, b) => Number(a.eliminated) - Number(b.eliminated) || a.points - b.points);

  return sorted.reduce<Row[]>((rows, player, index) => {
    const previous = rows[index - 1];
    const tied = previous && previous.points === player.points && previous.eliminated === player.eliminated;
    return [...rows, { ...player, position: tied ? previous.position : index + 1 }];
  }, []);
}

export function RoundSummary({ room, state, userId, onExit }: Props) {
  const matchOver = state.phase === "ended";
  const playingWithBots = Object.values(state.players).some((player) => player.bot);
  const showChips = hasChips(state);
  const me = state.players[room.sessionId];
  const choosingReturn = me?.awaitingReturn === true;

  if (matchOver && showChips) {
    return <MatchEnd matchId={state.matchId} userId={userId} aborted={false} title={announcementText(state)} onExit={onExit} />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.topBar}>
          {(matchOver || playingWithBots || showChips) && (
            <ExitButton title={showChips ? match.exit : match.back} confirm={!matchOver && showChips && needsExitConfirmation(me)} onExit={onExit} />
          )}
          <Text style={styles.tableTitle}>{tableTitle(state.table)}</Text>
        </View>
        <View style={styles.board}>
          <Text accessibilityRole="header" style={styles.title}>
            {announcementText(state)}
          </Text>
          <View style={styles.header}>
            <Text style={[styles.headerText, styles.position]}>{match.summary.position}</Text>
            <Text style={[styles.headerText, styles.name]}>{match.summary.player}</Text>
            <Text style={[styles.headerText, styles.number]}>{match.summary.round}</Text>
            <Text style={[styles.headerText, styles.number]}>{match.summary.total}</Text>
            {showChips && <Text style={[styles.headerText, styles.chips]}>{match.summary.chips}</Text>}
          </View>
          {ranking(state).map((row) => (
            <View key={row.sessionId} style={[styles.row, row.sessionId === state.wentOut && styles.wentOutRow]}>
              <Text style={[styles.place, styles.position]}>{match.summary.place.replace("{position}", String(row.position))}</Text>
              <View style={[styles.name, styles.player]}>
                <Avatar name={row.name} size={28} photoUrl={row.photoUrl} />
                <View style={styles.name}>
                  <Text style={styles.cell} numberOfLines={1}>
                    {row.name}
                  </Text>
                  {row.sessionId === state.wentOut && <Text style={[styles.badge, styles.wentOut]}>{match.summary.wentOut}</Text>}
                  {row.eliminated && <Text style={[styles.badge, styles.eliminated]}>{match.summary.eliminated}</Text>}
                  {row.sittingOut && <Text style={styles.badge}>{match.sittingOut}</Text>}
                  {row.awaitingReturn && <Text style={[styles.badge, styles.deciding]}>{match.summary.deciding}</Text>}
                </View>
              </View>
              <Text style={[styles.cell, styles.number, styles.round]}>+{row.roundPoints}</Text>
              <Text style={[styles.cell, styles.number, styles.total]}>{row.points}</Text>
              {showChips && <ChipsAmount value={row.roundChips} style={[styles.cell, styles.chips]} />}
            </View>
          ))}
        </View>
        {choosingReturn && <ReturnPrompt room={room} state={state} />}
        {!matchOver && <Text style={styles.next}>{match.summary.nextRound}</Text>}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flexGrow: 1, width: "100%", maxWidth: 520, alignSelf: "center", gap: 14, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 28 },
  topBar: { height: 40, flexDirection: "row", alignItems: "center" },
  tableTitle: { marginLeft: "auto", color: colors.feltText, fontSize: 13, fontFamily: fonts.semibold },
  board: { paddingTop: 20, paddingHorizontal: 14, paddingBottom: 16, gap: 6, borderRadius: 28, borderWidth: 1, borderColor: colors.line, backgroundColor: "rgba(10, 13, 12, 0.92)" },
  title: { marginHorizontal: 4, marginBottom: 8, color: colors.text, fontSize: 21, lineHeight: 26, fontFamily: fonts.display },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 8 },
  headerText: { color: colors.optionMuted, fontSize: 11.5, fontFamily: fonts.semibold },
  row: { minHeight: 54, paddingVertical: 6, paddingHorizontal: 8, flexDirection: "row", alignItems: "center", borderRadius: 14, borderWidth: 1, borderColor: "#1F2623", backgroundColor: colors.plate },
  wentOutRow: { borderColor: colors.action, backgroundColor: colors.successSurface },
  position: { width: 30 },
  place: { color: colors.muted, fontSize: 12, fontFamily: fonts.display },
  name: { flex: 1, minWidth: 0 },
  player: { flexDirection: "row", alignItems: "center", gap: 8 },
  number: { width: 50, textAlign: "right", fontVariant: ["tabular-nums"] },
  chips: { width: 66, textAlign: "right", fontVariant: ["tabular-nums"] },
  cell: { color: colors.text, fontSize: 14, fontFamily: fonts.semibold },
  round: { color: colors.muted, fontFamily: fonts.regular },
  total: { fontFamily: fonts.bold },
  badge: { color: colors.muted, fontSize: 11, fontFamily: fonts.semibold },
  wentOut: { color: colors.action },
  eliminated: { color: colors.errorText },
  deciding: { color: "#F2E6A6" },
  next: { marginTop: "auto", color: colors.feltSoft, fontSize: 14, fontFamily: fonts.regular, textAlign: "center" },
});
