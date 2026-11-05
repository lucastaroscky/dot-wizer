import { Fragment, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, { FadeInDown, FadeOut } from "react-native-reanimated";
import type { Room } from "@colyseus/sdk";
import type { PontinhoState } from "@pontinho/protocol";
import { ONLINE_MAX_PLAYERS, cardById, handPoints } from "@pontinho/rules";
import { WildContext } from "@/shared/cards/Card";
import { colors } from "@/shared/theme/colors";
import { fonts } from "@/shared/theme/fonts";
import { Icon } from "@/shared/ui/Icon";
import match from "@/messages/match.json";
import type { TableAreas } from "./areas";
import { CardFan } from "./CardFan";
import { ExitButton } from "./ExitButton";
import { FlightLayer } from "./FlightLayer";
import { Hand } from "./Hand";
import { Measured } from "./Measured";
import { Melds } from "./Melds";
import { Piles } from "./Piles";
import { PlayerPlate } from "./PlayerPlate";
import { announcementText, hasChips, isOffline, isSittingOut, needsExitConfirmation, tableTitle, wildCardsText, wildOf, type GameState } from "./state";
import { useFlights } from "./useFlights";
import { useTablePlay } from "./useTablePlay";

type Props = { room: Room<PontinhoState>; state: GameState; onExit: () => void };

export function Table({ room, state, onExit }: Props) {
  const areas = useRef<TableAreas>({ plates: {}, meldViews: [] });
  const [feltHeight, setFeltHeight] = useState(0);
  const play = useTablePlay(room, state, areas);
  const { flights, land } = useFlights(room, areas);

  const me = state.players[room.sessionId];
  const myHand = me?.hand ?? [];
  const seat = state.order.indexOf(room.sessionId);
  const opponents = [...state.order.slice(seat + 1), ...state.order.slice(0, seat)];
  const playingWithBots = Object.values(state.players).some((player) => player.bot);
  const announcement = announcementText(state);
  const showChips = hasChips(state);
  const turn = { duration: state.turnDuration, number: state.turnNumber };
  const wild = wildOf(state);
  const narrow = state.order.length > ONLINE_MAX_PLAYERS;

  return (
    <WildContext value={wild}>
      <SafeAreaView style={styles.table}>
        <View style={styles.topBar}>
          {(playingWithBots || showChips) && (
            <ExitButton title={showChips ? match.exit : match.back} confirm={showChips && needsExitConfirmation(me)} onExit={onExit} />
          )}
          <Text style={styles.tableTitle}>{tableTitle(state.table)}</Text>
        </View>
        <View accessibilityLabel={match.a11y.turnOrder} style={[styles.opponents, narrow && styles.opponentsInLine]}>
          {opponents.map((sessionId, index) => {
            const player = state.players[sessionId];
            return (
              <Fragment key={sessionId}>
                {narrow && index > 0 && <Icon name="chevron" size={10} color={colors.turnOrder} />}
                <Measured style={[styles.opponent, narrow && styles.opponentNarrow]} onMeasure={(rect) => (areas.current.plates[sessionId] = rect)}>
                  <CardFan count={player?.cardCount ?? 0} cardWidth={narrow ? NARROW_FAN_CARD_WIDTH : undefined} />
                  <PlayerPlate
                    name={player?.name ?? ""}
                    photoUrl={player?.photoUrl}
                    points={player?.points}
                    eliminated={player?.eliminated}
                    sittingOut={isSittingOut(player)}
                    offline={isOffline(player)}
                    isTurn={state.currentTurn === sessionId}
                    turn={turn}
                    narrow={narrow}
                  />
                </Measured>
              </Fragment>
            );
          })}
        </View>

        {announcement !== "" && (
          <Animated.View entering={FadeInDown.duration(250)} exiting={FadeOut.duration(200)} pointerEvents="none" style={styles.banner}>
            <Text style={styles.bannerText}>{announcement}</Text>
          </Animated.View>
        )}

        <View style={styles.middle}>
          <Piles
            flipped={state.flipped}
            lifeJokers={wild && wildCardsText(wild)}
            discardTop={state.discardTop}
            highlightDiscard={play.highlightDiscard}
            onStockPress={play.pressStock}
            onDiscardPress={play.pressDiscard}
            onDiscardMeasure={(rect) => (areas.current.discard = rect)}
            onDiscardView={(view) => (areas.current.discardView = view)}
            onStockMeasure={(rect) => (areas.current.stock = rect)}
          />
          <Measured
            style={styles.felt}
            onMeasure={(rect) => {
              areas.current.table = rect;
              setFeltHeight(rect.height - FELT_TOP_PADDING);
            }}
          >
            <Pressable style={styles.feltArea} onPress={play.pressTable}>
              <Melds
                melds={state.melds}
                height={feltHeight}
                highlightIndex={play.jokerMeldIndex}
                onMeldPress={play.pressMeld}
                onMeldView={(index, view) => (areas.current.meldViews[index] = view)}
              />
            </Pressable>
          </Measured>
        </View>

        {play.hasNotice ? (
          <View accessibilityRole="alert" style={styles.notice}>
            <Icon name="alert" size={16} color={colors.onAction} />
            <Text style={styles.noticeText}>{play.status}</Text>
          </View>
        ) : (
          <Text style={styles.status}>{play.status}</Text>
        )}

        <View style={styles.me}>
          <PlayerPlate
            name={me?.name ?? ""}
            photoUrl={me?.photoUrl}
            points={me?.points}
            eliminated={me?.eliminated}
            sittingOut={isSittingOut(me)}
            isTurn={state.currentTurn === room.sessionId}
            turn={turn}
            wide
          />
          {myHand.length > 0 && (
            <View style={styles.handPointsBox}>
              <Text style={styles.handPoints}>{handPoints(myHand.map((card) => cardById(card.id)), wild)}</Text>
              <View style={styles.handPointsHint}>
                <Icon name="eye" size={12} color={colors.feltText} />
                <Text style={styles.handPointsHintText}>{match.handPointsHint}</Text>
              </View>
            </View>
          )}
        </View>

        <Measured onMeasure={(rect) => (areas.current.hand = rect)}>
          <Hand cards={myHand} selectedIds={play.selectedIds} onToggle={play.toggle} onDropOutside={play.dropOutside} />
        </Measured>

        <FlightLayer flights={flights} onLanded={land} />
      </SafeAreaView>
    </WildContext>
  );
}

const NARROW_FAN_CARD_WIDTH = 14;
const FELT_TOP_PADDING = 70;

const styles = StyleSheet.create({
  table: { flex: 1, paddingHorizontal: 12, paddingTop: 8, paddingBottom: 4 },
  topBar: { height: 40, paddingHorizontal: 4, marginBottom: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  tableTitle: { marginLeft: "auto", color: colors.feltText, fontSize: 13, fontFamily: fonts.semibold, fontVariant: ["tabular-nums"] },
  opponents: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: 8 },
  opponentsInLine: { flexWrap: "nowrap", alignItems: "center", gap: 2 },
  opponent: { alignItems: "center", gap: 4 },
  opponentNarrow: { flex: 1, minWidth: 0 },
  banner: { position: "absolute", top: 200, alignSelf: "center", zIndex: 30, maxWidth: "90%", paddingVertical: 10, paddingHorizontal: 18, borderRadius: 22, borderWidth: 1, borderColor: colors.action, backgroundColor: "rgba(5, 7, 6, 0.75)" },
  bannerText: { color: colors.text, fontSize: 17, fontFamily: fonts.display, textAlign: "center" },
  middle: { flex: 1, flexDirection: "row", paddingTop: 16 },
  felt: { flex: 1 },
  feltArea: { flex: 1, paddingTop: FELT_TOP_PADDING },
  status: { color: colors.feltSoft, fontSize: 13.5, fontFamily: fonts.regular, lineHeight: 19, textAlign: "center", marginVertical: 8, marginHorizontal: 12 },
  notice: { marginVertical: 4, marginHorizontal: 8, paddingVertical: 9, paddingHorizontal: 12, borderRadius: 14, backgroundColor: colors.text, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  noticeText: { flexShrink: 1, color: colors.onAction, fontSize: 13.5, fontFamily: fonts.semibold, lineHeight: 18, textAlign: "center" },
  me: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", paddingHorizontal: 4 },
  handPointsBox: { alignItems: "flex-end", gap: 3 },
  handPointsHint: { flexDirection: "row", alignItems: "center", gap: 4 },
  handPointsHintText: { color: colors.feltText, fontSize: 11, fontFamily: fonts.regular },
  handPoints: { color: colors.onSelected, fontSize: 24, fontFamily: fonts.display, fontVariant: ["tabular-nums"] },
});
