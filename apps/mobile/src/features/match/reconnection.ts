import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Room } from "@colyseus/sdk";
import type { PontinhoState } from "@pontinho/protocol";
import { hasChips } from "./state";

const STORAGE_KEY = "pontinho.reconnectionToken";
const ENDED_PHASE = "ended";

export function saveReconnectionToken(token: string) {
  return AsyncStorage.setItem(STORAGE_KEY, token).catch(() => undefined);
}

export function loadReconnectionToken() {
  return AsyncStorage.getItem(STORAGE_KEY).catch(() => null);
}

export function forgetReconnectionToken() {
  return AsyncStorage.removeItem(STORAGE_KEY).catch(() => undefined);
}

export function keepReconnectionToken(room: Room<PontinhoState>) {
  const keep = () => {
    if (hasChips(room.state)) {
      saveReconnectionToken(room.reconnectionToken);
    }
  };
  room.onStateChange.once(keep);
  room.onReconnect(keep);
  room.onStateChange((state) => {
    if (state.phase === ENDED_PHASE) {
      forgetReconnectionToken();
    }
  });
}
