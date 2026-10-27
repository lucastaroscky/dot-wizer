import type { useRoomState } from "@colyseus/react";
import { toAnnouncement, type PontinhoState } from "@pontinho/protocol";
import { cardById } from "@pontinho/rules";
import type { CardView } from "@/shared/cards/Card";
import match from "@/messages/match.json";

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
  const name = state.players[state.announcementPlayer]?.name ?? "";
  return match.announcements[announcement].replace("{name}", name);
}
