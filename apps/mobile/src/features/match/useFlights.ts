import { useRef, useState, type RefObject } from "react";
import type { Room } from "@colyseus/sdk";
import type { PontinhoState } from "@pontinho/protocol";
import type { TableAreas } from "./areas";
import type { Flight } from "./FlightLayer";
import { useServerMessage } from "./messaging";
import { toCardView } from "./state";

const FLIGHT_STAGGER_MS = 40;

export function useFlights(room: Room<PontinhoState>, areas: RefObject<TableAreas>) {
  const [flights, setFlights] = useState<Flight[]>([]);
  const nextId = useRef(0);

  useServerMessage(room, "move", (event) => {
    const current = areas.current;
    const playerArea = event.playerId === room.sessionId ? current.hand : current.plates[event.playerId];
    const destinations = { draw: playerArea, discard: current.discard, toTable: current.table };
    const from = event.kind === "draw" ? current.stock : playerArea;
    const to = destinations[event.kind];
    if (!from || !to) {
      return;
    }
    const cards = event.cardIds.length === 0 ? [undefined] : event.cardIds.map(toCardView);
    const added = cards.map((card, index) => {
      nextId.current++;
      return { id: nextId.current, card, from, to, delay: index * FLIGHT_STAGGER_MS };
    });
    setFlights((list) => [...list, ...added]);
  });

  function land(flightId: number) {
    setFlights((list) => list.filter((flight) => flight.id !== flightId));
  }

  return { flights, land };
}
