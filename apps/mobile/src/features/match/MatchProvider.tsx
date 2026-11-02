import { createContext, use, useRef, useState, type ReactNode } from "react";
import { Asset } from "expo-asset";
import { Client, CloseCode, type Room } from "@colyseus/sdk";
import { ROOM_NAME, type CreateOptions, type PontinhoState } from "@pontinho/protocol";
import { getAccessToken } from "@/shared/api/client";
import { CardStyleContext, type CardStyleName } from "@/shared/cards/Card";
import { DECK_IMAGES } from "@/shared/cards/deck";
import { SERVER_URL } from "@/shared/config/env";
import home from "@/messages/home.json";
import { toJoinFailure } from "./joinFailure";

export type JoinRequest = CreateOptions & { cardStyle: CardStyleName };

type MatchSession = {
  room?: Room<PontinhoState>;
  connecting: boolean;
  error: string;
  openMatch: boolean;
  canResume: boolean;
  join: (request: JoinRequest) => Promise<void>;
  resume: () => Promise<void>;
  dismissOpenMatch: () => void;
  leave: () => void;
};

type OpenMatch = { reconnectionToken?: string };

const REQUEST_TIMEOUT_MS = 10_000;

function fetchWithTimeout(url: string | URL | Request, init?: RequestInit) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  return fetch(url, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer));
}

const client = new Client(SERVER_URL, { fetchFn: fetchWithTimeout });
const MatchContext = createContext<MatchSession | undefined>(undefined);

export function MatchProvider({ children }: { children: ReactNode }) {
  const [room, setRoom] = useState<Room<PontinhoState>>();
  const [cardStyle, setCardStyle] = useState<CardStyleName>("jumbo");
  const [error, setError] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [openMatch, setOpenMatch] = useState<OpenMatch>();
  const joining = useRef(false);

  async function enter(connect: () => Promise<Room<PontinhoState>>) {
    if (joining.current) {
      return;
    }
    joining.current = true;
    setConnecting(true);
    setError("");
    setOpenMatch(undefined);
    try {
      const joined = await connect();
      joined.onLeave((code) => {
        if (code === CloseCode.CONSENTED) {
          return;
        }
        setRoom(undefined);
        setError(home.connectionClosed);
      });
      setRoom(joined);
    } catch (joinError) {
      showJoinFailure(joinError);
    }
    joining.current = false;
    setConnecting(false);
  }

  function showJoinFailure(joinError: unknown) {
    const failure = toJoinFailure(joinError);
    if (failure.kind === "openMatch") {
      setOpenMatch({ reconnectionToken: failure.reconnectionToken });
      return;
    }
    setError(failure.text);
  }

  async function join(request: JoinRequest) {
    const { cardStyle: chosenCardStyle, ...options } = request;
    await enter(async () => {
      setCardStyle(chosenCardStyle);
      await Asset.loadAsync(Object.values(DECK_IMAGES[chosenCardStyle]));
      client.auth.token = await getAccessToken();
      return client.joinOrCreate<PontinhoState>(ROOM_NAME, options);
    });
  }

  async function resume() {
    const reconnectionToken = openMatch?.reconnectionToken;
    if (!reconnectionToken) {
      return;
    }
    await enter(() => client.reconnect<PontinhoState>(reconnectionToken));
  }

  function leave() {
    room?.leave();
    setRoom(undefined);
  }

  return (
    <MatchContext
      value={{
        room,
        connecting,
        error,
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
