import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Room } from "@colyseus/sdk";
import type { PontinhoState } from "@pontinho/protocol";
import { getSignedInUserId } from "@/shared/supabase/session";
import type { CardStyleName } from "@/shared/cards/Card";
import { hasChips } from "./state";

const STORAGE_KEY = "pontinho.seatKey";
const ENDED_PHASE = "ended";

export type SeatKey = { reconnectionToken: string; userId: string; cardStyle: CardStyleName };

export function saveSeatKey(seatKey: SeatKey) {
  return AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(seatKey)).catch(() => undefined);
}

async function loadSeatKey() {
  const stored = await AsyncStorage.getItem(STORAGE_KEY).catch(() => null);
  if (!stored) {
    return undefined;
  }
  try {
    return JSON.parse(stored) as SeatKey;
  } catch {
    return undefined;
  }
}

export function forgetSeatKey() {
  return AsyncStorage.removeItem(STORAGE_KEY).catch(() => undefined);
}

export async function findStoredSeatKey() {
  const seatKey = await loadSeatKey();
  if (!seatKey) {
    return undefined;
  }
  const userId = await getSignedInUserId();
  if (!userId) {
    return undefined;
  }
  if (seatKey.userId !== userId) {
    forgetSeatKey();
    return undefined;
  }
  return seatKey;
}

export function keepSeatKey(room: Room<PontinhoState>, cardStyle: CardStyleName) {
  const keep = async () => {
    if (!hasChips(room.state)) {
      return;
    }
    const reconnectionToken = room.reconnectionToken;
    const userId = await getSignedInUserId();
    if (!userId) {
      return;
    }
    await saveSeatKey({ reconnectionToken, userId, cardStyle });
  };
  room.onStateChange.once(keep);
  room.onReconnect(keep);
  room.onStateChange((state) => {
    if (state.phase === ENDED_PHASE) {
      forgetSeatKey();
    }
  });
}
