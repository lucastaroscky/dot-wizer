import { StyleSheet, View } from "react-native";
import { usePreventRemove } from "expo-router";
import type { Room } from "@colyseus/sdk";
import { useRoomState } from "@colyseus/react";
import type { PontinhoState } from "@pontinho/protocol";
import { colors } from "@/shared/theme/colors";
import { useMatch } from "./MatchProvider";
import { RoundSummary } from "./RoundSummary";
import { Table } from "./Table";
import { WaitingRoom } from "./WaitingRoom";

export function Match() {
  const { room, leave } = useMatch();
  usePreventRemove(room !== undefined, leave);

  return <View style={styles.screen}>{room && <MatchRoom room={room} onExit={leave} />}</View>;
}

type Props = { room: Room<PontinhoState>; onExit: () => void };

function MatchRoom({ room, onExit }: Props) {
  const state = useRoomState(room);

  if (!state?.order) {
    return null;
  }
  if (state.phase === "roundOver" || state.phase === "ended") {
    return <RoundSummary state={state} onExit={onExit} />;
  }
  if (state.phase === "playing") {
    return <Table room={room} state={state} onExit={onExit} />;
  }
  return <WaitingRoom state={state} />;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.felt, backgroundImage: colors.feltGradient },
});
