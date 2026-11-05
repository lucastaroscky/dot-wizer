import { useRef, useState, type RefObject } from "react";
import type { Room } from "@colyseus/sdk";
import { toMeld, type PontinhoState } from "@pontinho/protocol";
import { addToMeld, canGoOutWithDiscard, cardById, replaceJoker } from "@pontinho/rules";
import match from "@/messages/match.json";
import { contains, measureRect, type TableAreas } from "./areas";
import { sendAction, useServerMessage } from "./messaging";
import { isSittingOut, wildOf, type GameState } from "./state";

const DOUBLE_TAP_MS = 350;

type JokerSwap = { cardId: string; meldIndex: number };

function isJokerSwap(state: GameState, meldIndex: number, cardId: string) {
  const meld = toMeld(state.melds[meldIndex]);
  const card = cardById(cardId);
  const wild = wildOf(state);
  return !addToMeld(meld, [card], { wild }) && replaceJoker(meld, card, { wild }) !== undefined;
}

export function useTablePlay(room: Room<PontinhoState>, state: GameState, areas: RefObject<TableAreas>) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [notice, setNotice] = useState({ text: "", turnNumber: 0 });
  const [jokerSwap, setJokerSwap] = useState<JokerSwap>();
  const lastTableTap = useRef(0);

  useServerMessage(room, "invalid", (error) => showNotice(match.errors[error]));

  const noticeText = notice.turnNumber === state.turnNumber ? notice.text : "";
  const me = state.players[room.sessionId];
  const isMyTurn = state.currentTurn === room.sessionId;
  const inPlay = me?.eliminated !== true && !isSittingOut(me);
  const canGoOut = canGoOutWithDiscard(state, room.sessionId) && !me?.bluffed && inPlay;

  function showNotice(text: string) {
    setNotice({ text, turnNumber: state.turnNumber });
  }

  function play(action: () => void) {
    if (!isMyTurn) {
      showNotice(match.notices.waitYourTurn);
      return;
    }
    action();
    setSelectedIds([]);
    setJokerSwap(undefined);
    showNotice("");
  }

  function meldCards(cardIds: string[]) {
    if (!state.hasDrawn) {
      showNotice(match.notices.drawBeforeMeld);
      return;
    }
    play(() => sendAction(room, "meld", { cardIds }));
  }

  function layOffCards(cardIds: string[], meldIndex: number) {
    if (!state.hasDrawn) {
      showNotice(match.notices.drawBeforeLayOff);
      return;
    }
    if (cardIds.length === 1 && isJokerSwap(state, meldIndex, cardIds[0])) {
      setJokerSwap({ cardId: cardIds[0], meldIndex });
      setSelectedIds([]);
      showNotice("");
      return;
    }
    play(() => sendAction(room, "layOff", { cardIds, meldIndex }));
  }

  function discardCard(cardId: string) {
    if (!state.hasDrawn) {
      showNotice(match.notices.drawBeforeDiscard);
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
    if (!inPlay) {
      return;
    }
    const now = Date.now();
    const isDoubleTap = now - lastTableTap.current < DOUBLE_TAP_MS;
    lastTableTap.current = now;
    if (!isDoubleTap) {
      return;
    }
    sendAction(room, "goOut");
    showNotice("");
  }

  function toggle(cardId: string) {
    showNotice("");
    if (selectedIds.includes(cardId)) {
      setSelectedIds(selectedIds.filter((id) => id !== cardId));
      return;
    }
    setSelectedIds([...selectedIds, cardId]);
  }

  function pressStock() {
    if (state.hasDrawn) {
      showNotice(match.notices.alreadyDrew);
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
      showNotice(match.notices.selectOneToDiscard);
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

  async function dropOutside(cardId: string, x: number, y: number) {
    const cardIds = selectedIds.includes(cardId) ? selectedIds : [...selectedIds, cardId];
    const meldViews = areas.current.meldViews.slice(0, state.melds.length);
    const [discard, ...melds] = await Promise.all([areas.current.discardView, ...meldViews].map(measureRect));
    if (contains(discard, x, y)) {
      discardCard(cardId);
      return;
    }
    const meldIndex = melds.findIndex((rect) => contains(rect, x, y));
    if (meldIndex !== -1) {
      layOffCards(cardIds, meldIndex);
      return;
    }
    meldCards(cardIds);
  }

  function status() {
    if (noticeText) {
      return noticeText;
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
    hasNotice: noticeText !== "",
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
