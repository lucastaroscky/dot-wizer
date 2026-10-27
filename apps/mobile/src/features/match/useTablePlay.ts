import { useRef, useState, type RefObject } from "react";
import type { Room } from "@colyseus/sdk";
import { toMeld, type PontinhoState } from "@pontinho/protocol";
import { addToMeld, canGoOutWithDiscard, cardById, replaceJoker } from "@pontinho/rules";
import match from "@/messages/match.json";
import { contains, type TableAreas } from "./areas";
import { sendAction, useServerMessage } from "./messaging";
import type { GameState } from "./state";

const DOUBLE_TAP_MS = 350;

type JokerSwap = { cardId: string; meldIndex: number };

function isJokerSwap(state: GameState, meldIndex: number, cardId: string) {
  const meld = toMeld(state.melds[meldIndex]);
  const card = cardById(cardId);
  return !addToMeld(meld, [card]) && replaceJoker(meld, card) !== undefined;
}

export function useTablePlay(room: Room<PontinhoState>, state: GameState, areas: RefObject<TableAreas>) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [notice, setNotice] = useState("");
  const [jokerSwap, setJokerSwap] = useState<JokerSwap>();
  const lastTableTap = useRef(0);

  useServerMessage(room, "invalid", (error) => setNotice(match.errors[error]));

  const me = state.players[room.sessionId];
  const isMyTurn = state.currentTurn === room.sessionId;
  const canGoOut = canGoOutWithDiscard(state, room.sessionId) && !me?.bluffed;

  function play(action: () => void) {
    if (!isMyTurn) {
      setNotice(match.notices.waitYourTurn);
      return;
    }
    action();
    setSelectedIds([]);
    setJokerSwap(undefined);
    setNotice("");
  }

  function meldCards(cardIds: string[]) {
    if (!state.hasDrawn) {
      setNotice(match.notices.drawBeforeMeld);
      return;
    }
    play(() => sendAction(room, "meld", { cardIds }));
  }

  function layOffCards(cardIds: string[], meldIndex: number) {
    if (!state.hasDrawn) {
      setNotice(match.notices.drawBeforeLayOff);
      return;
    }
    if (cardIds.length === 1 && isJokerSwap(state, meldIndex, cardIds[0])) {
      setJokerSwap({ cardId: cardIds[0], meldIndex });
      setSelectedIds([]);
      setNotice("");
      return;
    }
    play(() => sendAction(room, "layOff", { cardIds, meldIndex }));
  }

  function discardCard(cardId: string) {
    if (!state.hasDrawn) {
      setNotice(match.notices.drawBeforeDiscard);
      return;
    }
    play(() => sendAction(room, "discard", cardId));
  }

  function placeJoker(meldIndex?: number) {
    if (!jokerSwap) {
      return;
    }
    play(() => sendAction(room, "layOff", { cardIds: [jokerSwap.cardId], meldIndex: jokerSwap.meldIndex, jokerTo: { meldIndex, cardIds: selectedIds } }));
  }

  function tapToGoOut() {
    const now = Date.now();
    const isDoubleTap = now - lastTableTap.current < DOUBLE_TAP_MS;
    lastTableTap.current = now;
    if (!isDoubleTap) {
      return;
    }
    sendAction(room, "goOut");
    setNotice("");
  }

  function toggle(cardId: string) {
    setNotice("");
    if (selectedIds.includes(cardId)) {
      setSelectedIds(selectedIds.filter((id) => id !== cardId));
      return;
    }
    setSelectedIds([...selectedIds, cardId]);
  }

  function pressStock() {
    if (state.hasDrawn) {
      setNotice(match.notices.alreadyDrew);
      return;
    }
    play(() => sendAction(room, "draw"));
  }

  function pressDiscard() {
    if (!state.hasDrawn) {
      play(() => sendAction(room, "takeDiscard", { cardIds: selectedIds }));
      return;
    }
    if (selectedIds.length !== 1) {
      setNotice(match.notices.selectOneToDiscard);
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
    if (contains(areas.current.discard, x, y)) {
      discardCard(cardId);
      return;
    }
    const meldIndex = areas.current.melds.findIndex((rect, index) => index < state.melds.length && contains(rect, x, y));
    if (meldIndex !== -1) {
      layOffCards(cardIds, meldIndex);
      return;
    }
    meldCards(cardIds);
  }

  function status() {
    if (notice) {
      return notice;
    }
    if (jokerSwap) {
      return match.status.placeJoker;
    }
    if (canGoOut) {
      return match.status.goOutWithDiscard;
    }
    if (!isMyTurn) {
      return match.status.turnOf.replace("{name}", state.players[state.currentTurn]?.name ?? "");
    }
    if (!state.hasDrawn) {
      return match.status.draw;
    }
    return match.status.play;
  }

  return {
    selectedIds,
    hasNotice: notice !== "",
    status: status(),
    jokerMeldIndex: jokerSwap?.meldIndex,
    highlightDiscard: (isMyTurn && state.hasDrawn) || canGoOut,
    toggle,
    pressStock,
    pressDiscard,
    pressTable,
    pressMeld,
    dropOutside,
  };
}
