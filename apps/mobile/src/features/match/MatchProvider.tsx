import { createContext, use, useEffect, useEffectEvent, useRef, useState, type ReactNode } from "react";
import { AppState } from "react-native";
import { Asset } from "expo-asset";
import { Client, CloseCode, ErrorCode, MatchMakeError, type Room } from "@colyseus/sdk";
import { CLOSE_CODES, ROOM_NAME, type CreateOptions, type PontinhoState } from "@pontinho/protocol";
import { getAccessToken } from "@/shared/api/client";
import { fetchWithTimeout } from "@/shared/api/fetchWithTimeout";
import { profileQueryOptions } from "@/shared/api/profile";
import { queryClient } from "@/shared/api/queryClient";
import { endSession } from "@/shared/api/sessionEnd";
import { CardStyleContext, type CardStyleName } from "@/shared/cards/Card";
import { DECK_IMAGES } from "@/shared/cards/deck";
import { SERVER_URL } from "@/shared/config/env";
import { onSignedOut } from "@/shared/supabase/session";
import home from "@/messages/home.json";
import { toJoinFailure } from "./joinFailure";
import { findStoredSeatKey, forgetSeatKey, keepSeatKey, type SeatKey } from "./seatKey";
import { hasChips } from "./state";

export type JoinRequest = CreateOptions & { cardStyle: CardStyleName };

type MatchSession = {
  room?: Room<PontinhoState>;
  connecting: boolean;
  reconnecting: boolean;
  error: string;
  matchAborted: boolean;
  openMatch: boolean;
  canResume: boolean;
  join: (request: JoinRequest) => Promise<void>;
  resume: () => Promise<void>;
  dismissOpenMatch: () => void;
  leave: () => void;
};

type OpenMatch = { reconnectionToken?: string };

type Entry = {
  cardStyle: CardStyleName;
  connect: () => Promise<Room<PontinhoState>>;
  onFailure?: (reason: unknown) => void;
};

const SEAT_HOLD_ATTEMPTS = 29;

const client = new Client(SERVER_URL, { fetchFn: fetchWithTimeout });
const MatchContext = createContext<MatchSession | undefined>(undefined);

function loadDeck(cardStyle: CardStyleName) {
  return Asset.loadAsync(Object.values(DECK_IMAGES[cardStyle]));
}

function seatIsGone(reason: unknown) {
  return reason instanceof MatchMakeError && (reason.code === ErrorCode.MATCHMAKE_INVALID_ROOM_ID || reason.code === ErrorCode.MATCHMAKE_EXPIRED);
}

export function MatchProvider({ children }: { children: ReactNode }) {
  const [room, setRoom] = useState<Room<PontinhoState>>();
  const [cardStyle, setCardStyle] = useState<CardStyleName>("jumbo");
  const [error, setError] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [openMatch, setOpenMatch] = useState<OpenMatch>();
  const [matchAborted, setMatchAborted] = useState(false);
  const joining = useRef(false);

  function watch(joined: Room<PontinhoState>, joinedCardStyle: CardStyleName) {
    keepSeatKey(joined, joinedCardStyle);
    joined.reconnection.minUptime = 0;
    joined.reconnection.maxRetries = SEAT_HOLD_ATTEMPTS;
    joined.onDrop(() => setReconnecting(true));
    joined.onReconnect(() => setReconnecting(false));
    joined.onLeave((code) => {
      setReconnecting(false);
      if (code === CloseCode.FAILED_TO_RECONNECT) {
        forgetSeatKey();
        setRoom(undefined);
        setError(home.connectionClosed);
        return;
      }
      if (code === CloseCode.CONSENTED) {
        forgetSeatKey();
        return;
      }
      if (code === CLOSE_CODES.matchAborted) {
        forgetSeatKey();
        setMatchAborted(true);
        return;
      }
      if (!hasChips(joined.state)) {
        setRoom(undefined);
        setError(home.connectionClosed);
        return;
      }
      reconnectAfterDrop(joined.reconnectionToken, joinedCardStyle);
    });
  }

  async function enter({ cardStyle: entryCardStyle, connect, onFailure = showJoinFailure }: Entry) {
    if (joining.current) {
      return;
    }
    joining.current = true;
    setConnecting(true);
    setError("");
    setOpenMatch(undefined);
    setMatchAborted(false);
    setCardStyle(entryCardStyle);
    try {
      const joined = await connect();
      watch(joined, entryCardStyle);
      setRoom(joined);
    } catch (reason) {
      onFailure(reason);
    }
    joining.current = false;
    setConnecting(false);
  }

  function showJoinFailure(reason: unknown) {
    const failure = toJoinFailure(reason);
    if (failure.kind === "openMatch") {
      setOpenMatch({ reconnectionToken: failure.reconnectionToken });
      return;
    }
    if (failure.kind === "sessionEnded") {
      endSession(failure.reason);
      return;
    }
    if (failure.kind === "profileIncomplete") {
      queryClient.invalidateQueries({ queryKey: profileQueryOptions().queryKey });
      return;
    }
    setError(failure.text);
  }

  function forgetSeatKeyWhenGone(reason: unknown) {
    if (seatIsGone(reason)) {
      forgetSeatKey();
    }
  }

  function reconnectAfterDrop(reconnectionToken: string, droppedCardStyle: CardStyleName) {
    return enter({
      cardStyle: droppedCardStyle,
      connect: () => client.reconnect<PontinhoState>(reconnectionToken),
      onFailure: (reason) => {
        forgetSeatKeyWhenGone(reason);
        setRoom(undefined);
        setError(home.connectionClosed);
      },
    });
  }

  const returnToSeat = useEffectEvent(async (seatKey: SeatKey) => {
    if (room || joining.current) {
      return;
    }
    await enter({
      cardStyle: seatKey.cardStyle,
      connect: async () => {
        await loadDeck(seatKey.cardStyle);
        return client.reconnect<PontinhoState>(seatKey.reconnectionToken);
      },
      onFailure: forgetSeatKeyWhenGone,
    });
  });

  const leaveOnSignOut = useEffectEvent(() => {
    leave();
    setOpenMatch(undefined);
  });

  useEffect(() => {
    const lookForSeat = () =>
      findStoredSeatKey().then((seatKey) => {
        if (seatKey) {
          returnToSeat(seatKey);
        }
      });
    lookForSeat();
    const appState = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        lookForSeat();
      }
    });
    const stopListeningSignOut = onSignedOut(() => leaveOnSignOut());
    return () => {
      appState.remove();
      stopListeningSignOut();
    };
  }, []);

  async function join(request: JoinRequest) {
    const { cardStyle: chosenCardStyle, ...options } = request;
    await enter({
      cardStyle: chosenCardStyle,
      connect: async () => {
        await loadDeck(chosenCardStyle);
        client.auth.token = await getAccessToken();
        return client.joinOrCreate<PontinhoState>(ROOM_NAME, options);
      },
    });
  }

  async function resume() {
    const reconnectionToken = openMatch?.reconnectionToken;
    if (!reconnectionToken) {
      return;
    }
    await enter({ cardStyle, connect: () => client.reconnect<PontinhoState>(reconnectionToken) });
  }

  function leave() {
    forgetSeatKey();
    room?.leave();
    setRoom(undefined);
    setMatchAborted(false);
  }

  return (
    <MatchContext
      value={{
        room,
        connecting,
        reconnecting,
        error,
        matchAborted,
        openMatch: openMatch !== undefined,
        canResume: openMatch?.reconnectionToken !== undefined,
        join,
        resume,
        dismissOpenMatch: () => setOpenMatch(undefined),
        leave,
      }}
    >
      <CardStyleContext value={cardStyle}>{children}</CardStyleContext>
    </MatchContext>
  );
}

export function useMatch() {
  const session = use(MatchContext);
  if (!session) {
    throw new Error("useMatch precisa estar dentro de MatchProvider");
  }
  return session;
}
