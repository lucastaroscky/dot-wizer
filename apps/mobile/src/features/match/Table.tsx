import { useRef } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, { FadeInDown, FadeOut } from "react-native-reanimated";
import type { Room } from "@colyseus/sdk";
import type { PontinhoState } from "@pontinho/protocol";
import { cardById, handPoints } from "@pontinho/rules";
import { colors } from "@/shared/theme/colors";
import { WoodButton } from "@/shared/ui/WoodButton";
import match from "@/messages/match.json";
import type { TableAreas } from "./areas";
import { CardFan } from "./CardFan";
import { FlightLayer } from "./FlightLayer";
import { Hand } from "./Hand";
import { Measured } from "./Measured";
import { Melds } from "./Melds";
import { Piles } from "./Piles";
import { PlayerPlate } from "./PlayerPlate";
import { announcementText, type GameState } from "./state";
import { useFlights } from "./useFlights";
import { useTablePlay } from "./useTablePlay";

type Props = { room: Room<PontinhoState>; state: GameState; onExit: () => void };

export function Table({ room, state, onExit }: Props) {
  const areas = useRef<TableAreas>({ plates: {}, melds: [] });
  const play = useTablePlay(room, state, areas);
  const { flights, land } = useFlights(room, areas);

  const me = state.players[room.sessionId];
  const seat = state.order.indexOf(room.sessionId);
  const opponents = [...state.order.slice(seat + 1), ...state.order.slice(0, seat)];
  const playingWithBots = Object.values(state.players).some((player) => player.bot);
  const announcement = announcementText(state);
  const turn = { duration: state.turnDuration, number: state.turnNumber };

  return (
    <SafeAreaView style={styles.table}>
      <View style={styles.opponents}>
        {opponents.map((sessionId) => {
          const player = state.players[sessionId];
          return (
            <Measured key={sessionId} style={styles.opponent} onMeasure={(rect) => (areas.current.plates[sessionId] = rect)}>
              <CardFan count={player?.cardCount ?? 0} />
              <PlayerPlate
                name={player?.name ?? ""}
                points={player?.points}
                eliminated={player?.eliminated}
                isTurn={state.currentTurn === sessionId}
                turn={turn}
              />
            </Measured>
          );
        })}
      </View>

      {announcement !== "" && (
        <Animated.View entering={FadeInDown.duration(250)} exiting={FadeOut.duration(200)} style={styles.banner}>
          <Text style={styles.bannerText}>{announcement}</Text>
        </Animated.View>
      )}

      <View style={styles.middle}>
        <Piles
          discardTop={state.discardTop}
          highlightDiscard={play.highlightDiscard}
          onStockPress={play.pressStock}
          onDiscardPress={play.pressDiscard}
          onDiscardMeasure={(rect) => (areas.current.discard = rect)}
          onStockMeasure={(rect) => (areas.current.stock = rect)}
        />
        <Measured style={styles.felt} onMeasure={(rect) => (areas.current.table = rect)}>
          <Pressable style={styles.feltArea} onPress={play.pressTable}>
            <Melds
              melds={state.melds}
              highlightIndex={play.jokerMeldIndex}
              onMeldPress={play.pressMeld}
              onMeldMeasure={(index, rect) => (areas.current.melds[index] = rect)}
            />
          </Pressable>
        </Measured>
      </View>

      <Text style={[styles.status, play.hasNotice && styles.notice]}>{play.status}</Text>

      <View style={styles.me}>
        <PlayerPlate name={me?.name ?? ""} points={me?.points} isTurn={state.currentTurn === room.sessionId} turn={turn} />
      </View>

      <Text style={styles.handPoints}>{handPoints((me?.hand ?? []).map((card) => cardById(card.id)))}</Text>

      <Measured onMeasure={(rect) => (areas.current.hand = rect)}>
        <Hand cards={me?.hand ?? []} selectedIds={play.selectedIds} onToggle={play.toggle} onDropOutside={play.dropOutside} />
      </Measured>

      <FlightLayer flights={flights} onLanded={land} />

      {playingWithBots && (
        <View style={styles.exit}>
          <WoodButton title={match.back} onPress={onExit} />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  table: { flex: 1, padding: 12 },
  opponents: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-around", gap: 8 },
  opponent: { alignItems: "center", gap: 2 },
  banner: { alignSelf: "center", marginTop: 8, backgroundColor: "rgba(0, 0, 0, 0.45)", borderRadius: 8, paddingVertical: 6, paddingHorizontal: 14 },
  bannerText: { color: colors.highlight, fontSize: 16, fontWeight: "600", textAlign: "center" },
  middle: { flex: 1, flexDirection: "row", paddingTop: 16 },
  felt: { flex: 1 },
  feltArea: { flex: 1, paddingTop: 70 },
  status: { color: colors.cream, fontSize: 14, textAlign: "center", marginVertical: 6 },
  notice: { color: colors.highlight },
  me: { flexDirection: "row", alignItems: "center" },
  handPoints: { color: colors.cream, fontSize: 20, fontWeight: "800", textAlign: "center" },
  exit: { position: "absolute", top: 12, left: 12 },
});
