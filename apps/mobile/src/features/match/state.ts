import type { useRoomState } from "@colyseus/react";
import { toAnnouncement, type PontinhoState } from "@pontinho/protocol";
import { CHIP_TABLES, cardById, lifeJokerFor, type Suit, type Wild } from "@pontinho/rules";
import { formatChips } from "@/shared/format/numbers";
import type { CardView } from "@/shared/cards/Card";
import lobby from "@/messages/lobby.json";
import match from "@/messages/match.json";

const TRAINING_TABLE = 0;
const CONNECTED = "connected";

export type GameState = NonNullable<ReturnType<typeof useRoomState<PontinhoState>>>;

export function toCardView(cardId: string): CardView {
  const card = cardById(cardId);
  return { id: card.id, rank: card.rank, suit: card.rank === "JOKER" ? "" : card.suit };
}

export function announcementText(state: GameState) {
  const announcement = toAnnouncement(state.announcement);
  if (!announcement) {
    return "";
  }
  const player = state.players[state.announcementPlayer];
  return match.announcements[announcement].replace("{name}", player?.name ?? "").replace("{points}", String(player?.points ?? 0));
}

export function isOffline(player?: { connection: string }) {
  return player !== undefined && player.connection !== CONNECTED;
}

export function isSittingOut(player?: { sittingOut: boolean }) {
  return player?.sittingOut === true;
}

export function hasChips(state: { table: number }) {
  return state.table !== TRAINING_TABLE;
}

export function needsExitConfirmation(player?: { eliminated: boolean; sittingOut: boolean }) {
  return player?.eliminated !== true && !isSittingOut(player);
}

const SUIT_SYMBOLS: Record<Suit, string> = { spades: "♠", hearts: "♥", diamonds: "♦", clubs: "♣" };

export function wildOf(state: GameState): Wild | undefined {
  const flipped = state.flipped && cardById(state.flipped.id);
  if (!flipped || flipped.rank === "JOKER") {
    return undefined;
  }
  return lifeJokerFor(flipped);
}

export function cardText(card: { rank: string; suit: string }) {
  return `${card.rank}${SUIT_SYMBOLS[card.suit as Suit]}`;
}

export function wildCardsText(wild: Wild) {
  return wild.suits.map((suit) => cardText({ rank: wild.rank, suit })).join(" ");
}

export function tableTitle(tableId: number) {
  const table = CHIP_TABLES.find(({ id }) => id === tableId);
  if (!table) {
    return lobby.trainingHint;
  }
  return `${lobby.tableName.replace("{id}", String(table.id))} · ${lobby.pointValue.replace("{value}", formatChips(table.pointValue))}`;
}
