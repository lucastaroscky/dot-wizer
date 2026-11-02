import type { useRoomState } from "@colyseus/react";
import { toAnnouncement, type PontinhoState } from "@pontinho/protocol";
import { cardById } from "@pontinho/rules";
import type { CardView } from "@/shared/cards/Card";
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

export function hasChips(state: GameState) {
  return state.table !== TRAINING_TABLE;
}
