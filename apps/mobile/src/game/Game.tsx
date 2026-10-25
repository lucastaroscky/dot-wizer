import { StyleSheet, View } from "react-native";
import type { Room } from "@colyseus/sdk";
import { useRoomState } from "@colyseus/react";
import type { PontinhoRoom } from "../../../server/src/rooms/PontinhoRoom";
import { Table, type GameState } from "../table/Table";
import { WaitingRoom } from "./WaitingRoom";
import { RoundSummary } from "./RoundSummary";
import { colors } from "../table/colors";

type Props = { room: Room<PontinhoRoom>; onExit: () => void };

export function Game({ room, onExit }: Props) {
  const state = useRoomState(room);

  return (
    <View style={styles.screen}>
      <Content room={room} state={state} onExit={onExit} />
    </View>
  );
}

function Content({ room, state, onExit }: Props & { state: GameState | undefined }) {
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
