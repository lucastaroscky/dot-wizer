import { StyleSheet, View } from "react-native";
import { usePreventRemove } from "expo-router";
import type { Room } from "@colyseus/sdk";
import { useRoomState } from "@colyseus/react";
import type { PontinhoState } from "@pontinho/protocol";
import { colors } from "@/shared/theme/colors";
import match from "@/messages/match.json";
import { MatchEnd } from "./MatchEnd";
import { useMatch } from "./MatchProvider";
import { RoundSummary } from "./RoundSummary";
import { Table } from "./Table";
import { WaitingRoom } from "./WaitingRoom";

export function Match({ userId }: { userId?: string }) {
  const { room, matchAborted, leave } = useMatch();
  usePreventRemove(room !== undefined, leave);

  return <View style={styles.screen}>{room && <MatchRoom room={room} userId={userId} matchAborted={matchAborted} onExit={leave} />}</View>;
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
  screen: { flex: 1, backgroundColor: colors.feltNight, backgroundImage: colors.feltRoom, userSelect: "none" },
});
