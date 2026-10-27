import type { Room } from "@colyseus/sdk";
import { useRoomMessage } from "@colyseus/react";
import type { ClientMessages, PontinhoState, ServerMessages } from "@pontinho/protocol";

type Payload<T extends keyof ClientMessages> = ClientMessages[T] extends undefined ? [] : [ClientMessages[T]];

export function sendAction<T extends keyof ClientMessages>(room: Room<PontinhoState>, type: T, ...payload: Payload<T>) {
  room.send(type, ...payload);
}

export function useServerMessage<T extends keyof ServerMessages>(room: Room<PontinhoState>, type: T, handler: (message: ServerMessages[T]) => void) {
  useRoomMessage(room, type, handler);
}
