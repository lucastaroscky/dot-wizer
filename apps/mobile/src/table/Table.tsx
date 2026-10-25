import { useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View, type HostInstance } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, { FadeInDown, FadeOut } from "react-native-reanimated";
import type { Room } from "@colyseus/sdk";
import { useRoomMessage, type useRoomState } from "@colyseus/react";
import type { MoveEvent, PontinhoRoom } from "../../../server/src/rooms/PontinhoRoom";
import { addToMeld, createDeck, handPoints, replaceJoker, type Meld, type MeldKind } from "@pontinho/rules";
import { PlayerPlate } from "./PlayerPlate";
import { CardFan } from "./CardFan";
import { Hand } from "./Hand";
import { Melds, type Rect } from "./Melds";
import { Piles } from "./Piles";
import { FlightLayer, type Flight } from "./FlightLayer";
import { colors } from "./colors";
import { WoodButton } from "../ui/WoodButton";

export type GameState = NonNullable<ReturnType<typeof useRoomState<PontinhoRoom>>>;

type Props = { room: Room<PontinhoRoom>; state: GameState; onExit: () => void };

const DOUBLE_TAP_MS = 350;
const FLIGHT_STAGGER_MS = 40;
const CARDS_BY_ID = new Map(createDeck().map((card) => [card.id, card]));

type JokerSwap = { cardId: string; meldIndex: number };

function toMeld(meld: GameState["melds"][number]): Meld {
  return { kind: meld.kind as MeldKind, cards: meld.cards.map((card) => CARDS_BY_ID.get(card.id)!) };
}

function isJokerSwap(meld: Meld, cardId: string) {
  const card = CARDS_BY_ID.get(cardId);
  return card !== undefined && !addToMeld(meld, [card]) && replaceJoker(meld, card) !== undefined;
}

function toCardView(cardId: string) {
  const card = CARDS_BY_ID.get(cardId);
  if (!card) {
    return undefined;
  }
  return { id: card.id, rank: card.rank, suit: card.rank === "JOKER" ? "" : card.suit };
}

function measureInto(ref: { current: HostInstance | null }, save: (rect: Rect) => void) {
  ref.current?.measureInWindow((x, y, width, height) => save({ x, y, width, height }));
}

function contains(rect: Rect | undefined, x: number, y: number) {
  return rect !== undefined && x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height;
}

export function Table({ room, state, onExit }: Props) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [notice, setNotice] = useState("");
  const [jokerSwap, setJokerSwap] = useState<JokerSwap>();
  const lastTableTap = useRef(0);
  const meldRects = useRef<Rect[]>([]);
  const discardRect = useRef<Rect | undefined>(undefined);
  const stockRect = useRef<Rect | undefined>(undefined);
  const tableRect = useRef<Rect | undefined>(undefined);
  const handRect = useRef<Rect | undefined>(undefined);
  const plateRects = useRef<Record<string, Rect>>({});
  const tableRef = useRef<HostInstance>(null);
  const handRef = useRef<HostInstance>(null);
  const plateRefs = useRef<Record<string, HostInstance | null>>({});
  const [flights, setFlights] = useState<Flight[]>([]);
  const nextFlightId = useRef(0);

  useRoomMessage(room, "invalid", setNotice);
  useRoomMessage(room, "move", fly);

  const me = state.players[room.sessionId];
  const isMyTurn = state.currentTurn === room.sessionId;
  const seat = state.order.indexOf(room.sessionId);
  const opponents = [...state.order.slice(seat + 1), ...state.order.slice(0, seat)];
  const canGoOut = state.discardIsFree && !isMyTurn && state.lastDiscarder !== room.sessionId;
  const playingWithBots = Object.values(state.players).some((player) => player.bot);

  function playerRect(playerId: string) {
    if (playerId === room.sessionId) {
      return handRect.current;
    }
    return plateRects.current[playerId];
  }

  function fly(event: MoveEvent) {
    const playerArea = playerRect(event.playerId);
    const destinations = { draw: playerArea, discard: discardRect.current, toTable: tableRect.current };
    const from = event.kind === "draw" ? stockRect.current : playerArea;
    const to = destinations[event.kind];
    if (!from || !to) {
      return;
    }
    const cards = event.cardIds.length === 0 ? [undefined] : event.cardIds.map(toCardView);
    const newFlights = cards.map((card, index) => {
      nextFlightId.current++;
      return { id: nextFlightId.current, card, from, to, delay: index * FLIGHT_STAGGER_MS };
    });
    setFlights((current) => [...current, ...newFlights]);
  }

  function land(flightId: number) {
    setFlights((current) => current.filter((flight) => flight.id !== flightId));
  }

  function toggle(cardId: string) {
    setNotice("");
    if (selectedIds.includes(cardId)) {
      setSelectedIds(selectedIds.filter((id) => id !== cardId));
      return;
    }
    setSelectedIds([...selectedIds, cardId]);
  }

  function play(action: () => void) {
    if (!isMyTurn) {
      setNotice("Espere a sua vez");
      return;
    }
    action();
    setSelectedIds([]);
    setJokerSwap(undefined);
    setNotice("");
  }

  function meldCards(cardIds: string[]) {
    if (!state.hasDrawn) {
      setNotice("Compre uma carta antes de baixar");
      return;
    }
    play(() => room.send("meld", { cardIds }));
  }

  function layOffCards(cardIds: string[], meldIndex: number) {
    if (!state.hasDrawn) {
      setNotice("Compre uma carta antes de encaixar");
      return;
    }
    if (cardIds.length === 1 && isJokerSwap(toMeld(state.melds[meldIndex]), cardIds[0])) {
      setJokerSwap({ cardId: cardIds[0], meldIndex });
      setSelectedIds([]);
      setNotice("");
      return;
    }
    play(() => room.send("layOff", { cardIds, meldIndex }));
  }

  function discardCard(cardId: string) {
    if (!state.hasDrawn) {
      setNotice("Compre uma carta antes de descartar");
      return;
    }
    play(() => room.send("discard", cardId));
  }

  function placeJoker(meldIndex?: number) {
    if (!jokerSwap) {
      return;
    }
    play(() =>
      room.send("layOff", { cardIds: [jokerSwap.cardId], meldIndex: jokerSwap.meldIndex, jokerTo: { meldIndex, cardIds: selectedIds } }),
    );
  }

  function pressStock() {
    if (state.hasDrawn) {
      setNotice("Você já comprou nesta vez");
      return;
    }
    play(() => room.send("draw"));
  }

  function pressDiscard() {
    if (!state.hasDrawn) {
      play(() => room.send("takeDiscard", { cardIds: selectedIds }));
      return;
    }
    if (selectedIds.length !== 1) {
      setNotice("Selecione uma carta para descartar");
      return;
    }
    discardCard(selectedIds[0]);
  }

  function pressTable() {
    if (!isMyTurn) {
      tapToGoOut();
      return;
    }
    if (jokerSwap) {
      placeJoker();
      return;
    }
    if (selectedIds.length === 0) {
      return;
    }
    meldCards(selectedIds);
  }

  function pressMeld(meldIndex: number) {
    if (jokerSwap) {
      placeJoker(meldIndex);
      return;
    }
    if (selectedIds.length === 0) {
      return;
    }
    layOffCards(selectedIds, meldIndex);
  }

  function dropOutside(cardId: string, x: number, y: number) {
    const cardIds = selectedIds.includes(cardId) ? selectedIds : [...selectedIds, cardId];
    if (contains(discardRect.current, x, y)) {
      discardCard(cardId);
      return;
    }
    const meldIndex = meldRects.current.findIndex((rect, index) => index < state.melds.length && contains(rect, x, y));
    if (meldIndex !== -1) {
      layOffCards(cardIds, meldIndex);
      return;
    }
    meldCards(cardIds);
  }

  function tapToGoOut() {
    const now = Date.now();
    const isDoubleTap = now - lastTableTap.current < DOUBLE_TAP_MS;
    lastTableTap.current = now;
    if (!isDoubleTap) {
      return;
    }
    room.send("goOut");
    setNotice("");
  }

  function status() {
    if (notice) {
      return notice;
    }
    if (jokerSwap) {
      return "Agora escolha onde o coringa vai: toque noutro jogo, ou selecione cartas e toque na mesa";
    }
    if (canGoOut && !me?.bluffed) {
      return "Toque duas vezes na mesa para bater com o descarte";
    }
    if (!isMyTurn) {
      return `Vez de ${state.players[state.currentTurn]?.name}`;
    }
    if (!state.hasDrawn) {
      return "Toque no monte para comprar ou use o descarte num jogo";
    }
    return "Baixe, encaixe ou descarte para passar a vez";
  }

  return (
    <SafeAreaView style={styles.table}>
      <View style={styles.opponents}>
        {opponents.map((sessionId) => {
          const player = state.players[sessionId];
          return (
            <View
              key={sessionId}
              style={styles.opponent}
              ref={(element) => {
                plateRefs.current[sessionId] = element;
              }}
              onLayout={() => measureInto({ current: plateRefs.current[sessionId] }, (rect) => (plateRects.current[sessionId] = rect))}
            >
              <CardFan count={player?.cardCount ?? 0} />
              <PlayerPlate
                name={player?.name ?? ""}
                points={player?.points}
                eliminated={player?.eliminated}
                isTurn={state.currentTurn === sessionId}
                turnDeadline={state.turnDeadline}
              />
            </View>
          );
        })}
      </View>

      {state.announcement !== "" && (
        <Animated.View entering={FadeInDown.duration(250)} exiting={FadeOut.duration(200)} style={styles.banner}>
          <Text style={styles.bannerText}>{state.announcement}</Text>
        </Animated.View>
      )}

      <View style={styles.middle}>
        <Piles
          discardTop={state.discardTop}
          highlightDiscard={(isMyTurn && state.hasDrawn) || (canGoOut && !me?.bluffed)}
          onStockPress={pressStock}
          onDiscardPress={pressDiscard}
          onDiscardMeasure={(rect) => (discardRect.current = rect)}
          onStockMeasure={(rect) => (stockRect.current = rect)}
        />
        <Pressable ref={tableRef} onLayout={() => measureInto(tableRef, (rect) => (tableRect.current = rect))} style={styles.felt} onPress={pressTable}>
          <Melds
            melds={state.melds}
            highlightIndex={jokerSwap?.meldIndex}
            onMeldPress={pressMeld}
            onMeldMeasure={(index, rect) => (meldRects.current[index] = rect)}
          />
        </Pressable>
      </View>

      <Text style={[styles.status, notice !== "" && styles.notice]}>{status()}</Text>

      <View style={styles.me}>
        <PlayerPlate name={me?.name ?? ""} points={me?.points} isTurn={isMyTurn} turnDeadline={state.turnDeadline} />
      </View>

      <Text style={styles.handPoints}>{handPoints((me?.hand ?? []).map((card) => CARDS_BY_ID.get(card.id)!))}</Text>

      <View ref={handRef} onLayout={() => measureInto(handRef, (rect) => (handRect.current = rect))}>
        <Hand cards={me?.hand ?? []} selectedIds={selectedIds} onToggle={toggle} onDropOutside={dropOutside} />
      </View>

      <FlightLayer flights={flights} onLanded={land} />

      {playingWithBots && (
        <View style={styles.exit}>
          <WoodButton title="Voltar" onPress={onExit} />
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
  felt: { flex: 1, paddingTop: 70 },
  status: { color: colors.cream, fontSize: 14, textAlign: "center", marginVertical: 6 },
  notice: { color: colors.highlight },
  me: { flexDirection: "row", alignItems: "center" },
  handPoints: { color: colors.cream, fontSize: 20, fontWeight: "800", textAlign: "center" },
  exit: { position: "absolute", top: 12, left: 12 },
});
