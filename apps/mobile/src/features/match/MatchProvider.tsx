import { createContext, use, useRef, useState, type ReactNode } from "react";
import { Asset } from "expo-asset";
import { Client, CloseCode, type Room } from "@colyseus/sdk";
import { ROOM_NAME, type CreateOptions, type JoinOptions, type PontinhoState } from "@pontinho/protocol";
import { CardStyleContext, type CardStyleName } from "@/shared/cards/Card";
import { DECK_IMAGES } from "@/shared/cards/deck";
import { SERVER_URL } from "@/shared/config/env";
import home from "@/messages/home.json";

export type JoinRequest = { seats: number; bots: boolean; cardStyle: CardStyleName };

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

function guestName() {
  return home.guestName.replace("{number}", String(Math.floor(1000 + Math.random() * 9000)));
}

export function MatchProvider({ children }: { children: ReactNode }) {
  const [name] = useState(guestName);
  const [room, setRoom] = useState<Room<PontinhoState>>();
  const [cardStyle, setCardStyle] = useState<CardStyleName>("jumbo");
  const [error, setError] = useState("");
  const [connecting, setConnecting] = useState(false);
  const joining = useRef(false);

  async function join(request: JoinRequest) {
    if (joining.current) {
      return;
    }
    joining.current = true;
    setConnecting(true);
    setError("");
    setCardStyle(request.cardStyle);
    const options: JoinOptions & CreateOptions = { name, seats: request.seats, bots: request.bots };
    try {
      await Asset.loadAsync(Object.values(DECK_IMAGES[request.cardStyle]));
      const joined = await client.joinOrCreate<PontinhoState>(ROOM_NAME, options);
      joined.onLeave((code) => {
        if (code === CloseCode.CONSENTED) {
          return;
        }
        setRoom(undefined);
        setError(home.connectionClosed);
      });
      setRoom(joined);
    } catch {
      setError(home.joinFailed);
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
