import { createContext, use, useRef, useState, type ReactNode } from "react";
import { Asset } from "expo-asset";
import { Client, CloseCode, MatchMakeError, type Room } from "@colyseus/sdk";
import { JOIN_REFUSALS, ROOM_NAME, type CreateOptions, type JoinRefusal, type PontinhoState } from "@pontinho/protocol";
import { getAccessToken } from "@/shared/api/client";
import { CardStyleContext, type CardStyleName } from "@/shared/cards/Card";
import { DECK_IMAGES } from "@/shared/cards/deck";
import { SERVER_URL } from "@/shared/config/env";
import home from "@/messages/home.json";

export type JoinRequest = CreateOptions & { cardStyle: CardStyleName };

type MatchSession = {
  room?: Room<PontinhoState>;
  connecting: boolean;
  error: string;
  join: (request: JoinRequest) => Promise<void>;
  leave: () => void;
};

const REQUEST_TIMEOUT_MS = 10_000;

function fetchWithTimeout(url: string | URL | Request, init?: RequestInit) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  return fetch(url, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer));
}

const client = new Client(SERVER_URL, { fetchFn: fetchWithTimeout });
const MatchContext = createContext<MatchSession | undefined>(undefined);

const REFUSALS = Object.keys(JOIN_REFUSALS) as JoinRefusal[];

function joinErrorText(error: unknown) {
  if (!(error instanceof MatchMakeError)) {
    return home.joinFailed;
  }
  const refusal = REFUSALS.find((key) => JOIN_REFUSALS[key].message === error.message);
  if (!refusal) {
    return home.joinFailed;
  }
  return home.joinRefusals[refusal];
}

export function MatchProvider({ children }: { children: ReactNode }) {
  const [room, setRoom] = useState<Room<PontinhoState>>();
  const [cardStyle, setCardStyle] = useState<CardStyleName>("jumbo");
  const [error, setError] = useState("");
  const [connecting, setConnecting] = useState(false);
  const joining = useRef(false);
  const droppedToken = useRef<string>(undefined);

  async function reconnectToDroppedRoom() {
    const token = droppedToken.current;
    droppedToken.current = undefined;
    if (!token) {
      return undefined;
    }
    return client.reconnect<PontinhoState>(token).catch(() => undefined);
  }

  async function connect(options: CreateOptions) {
    client.auth.token = await getAccessToken();
    const reconnected = await reconnectToDroppedRoom();
    if (reconnected) {
      return reconnected;
    }
    return client.joinOrCreate<PontinhoState>(ROOM_NAME, options);
  }

  async function join(request: JoinRequest) {
    if (joining.current) {
      return;
    }
    joining.current = true;
    setConnecting(true);
    setError("");
    const { cardStyle: chosenCardStyle, ...options } = request;
    setCardStyle(chosenCardStyle);
    try {
      await Asset.loadAsync(Object.values(DECK_IMAGES[chosenCardStyle]));
      const joined = await connect(options);
      joined.onLeave((code) => {
        if (code === CloseCode.CONSENTED) {
          return;
        }
        droppedToken.current = joined.reconnectionToken;
        setRoom(undefined);
        setError(home.connectionClosed);
      });
      setRoom(joined);
    } catch (joinError) {
      setError(joinErrorText(joinError));
    }
    joining.current = false;
    setConnecting(false);
  }

  function leave() {
    room?.leave();
    setRoom(undefined);
  }

  return (
    <MatchContext value={{ room, connecting, error, join, leave }}>
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
