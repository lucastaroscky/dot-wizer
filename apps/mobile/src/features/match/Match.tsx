import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { usePreventRemove } from "expo-router";
import type { Room } from "@colyseus/sdk";
import { useRoomState } from "@colyseus/react";
import type { PontinhoState } from "@pontinho/protocol";
import { colors } from "@/shared/theme/colors";
import { fonts } from "@/shared/theme/fonts";
import match from "@/messages/match.json";
import { MatchEnd } from "./MatchEnd";
import { useMatch } from "./MatchProvider";
import { RoundSummary } from "./RoundSummary";
import { Table } from "./Table";
import { WaitingRoom } from "./WaitingRoom";

export function Match({ userId }: { userId?: string }) {
  const { room, connecting, reconnecting, matchAborted, leave } = useMatch();
  usePreventRemove(room !== undefined, leave);

  return (
    <View style={styles.screen}>
      {room && <MatchRoom room={room} userId={userId} matchAborted={matchAborted} onExit={leave} />}
      {room && (reconnecting || connecting) && (
        <View style={styles.reconnecting}>
          <View accessibilityRole="alert" style={styles.reconnectingPill}>
            <ActivityIndicator size="small" color={colors.action} />
            <Text style={styles.reconnectingText}>{match.reconnecting}</Text>
          </View>
        </View>
      )}
    </View>
  );
}

type Props = { room: Room<PontinhoState>; userId?: string; matchAborted: boolean; onExit: () => void };

function MatchRoom({ room, userId, matchAborted, onExit }: Props) {
  const state = useRoomState(room);

  if (matchAborted) {
    return <MatchEnd matchId={room.state.matchId} userId={userId} aborted title={match.matchAborted} onExit={onExit} />;
  }
  if (!state?.order) {
    return null;
  }
  if (state.phase === "roundOver" || state.phase === "ended") {
    return <RoundSummary room={room} state={state} userId={userId} onExit={onExit} />;
  }
  if (state.phase === "playing") {
    return <Table room={room} state={state} onExit={onExit} />;
  }
  return <WaitingRoom state={state} onExit={onExit} />;
}

const styles = StyleSheet.create({
  reconnecting: { ...StyleSheet.absoluteFill, alignItems: "center", paddingTop: 110, backgroundColor: "rgba(3, 6, 4, 0.6)" },
  reconnectingPill: { height: 44, paddingHorizontal: 18, borderRadius: 22, borderWidth: 1, borderColor: colors.lineStrong, backgroundColor: colors.surface, flexDirection: "row", alignItems: "center", gap: 10 },
  reconnectingText: { color: colors.text, fontSize: 15, fontFamily: fonts.semibold },
  screen: { flex: 1, backgroundColor: colors.feltNight, backgroundImage: colors.feltRoom, userSelect: "none" },
});
