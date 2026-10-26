import { Client, type Room } from "@colyseus/sdk";
import { addToMeld, canDiscard, cardById, findMeldInHand } from "@pontinho/rules";
import { ROOM_NAME } from "@pontinho/protocol";
import type { PontinhoRoom } from "../src/rooms/pontinho/PontinhoRoom.js";

const SERVER_URL = "http://localhost:2567";
const PLAY_DELAY_MS = 1500;
const botCount = Number(process.argv[2] ?? 2);
const seats = Number(process.argv[3] ?? 3);

for (let bot = 1; bot <= botCount; bot++) {
  startBot(`Robô ${bot}`);
}

async function startBot(name: string) {
  const room = await new Client(SERVER_URL).joinOrCreate<PontinhoRoom>(ROOM_NAME, { name, seats, bots: false });
  console.log(`${name} entrou na sala ${room.roomId}`);
  let acting = false;
  let rejoined = false;

  room.onStateChange((state) => {
    if (state.phase === "ended" && !rejoined) {
      rejoined = true;
      room.leave();
      startBot(name);
      return;
    }
    if (acting || state.phase !== "playing" || state.currentTurn !== room.sessionId) {
      return;
    }
    acting = true;
    setTimeout(() => {
      play(room);
      acting = false;
    }, PLAY_DELAY_MS);
  });
}

function play(room: Room<PontinhoRoom>) {
  if (!room.state.hasDrawn) {
    room.send("draw");
    return;
  }
  const player = room.state.players.get(room.sessionId);
  if (!player) {
    return;
  }
  const hand = player.hand.map((card) => cardById(card.id));
  const table = room.state.melds.map((meld) => ({ kind: meld.kind as "set" | "run", cards: meld.cards.map((card) => cardById(card.id)) }));
  const meld = findMeldInHand(hand);
  if (meld) {
    room.send("meld", { cardIds: meld.map((card) => card.id) });
    return;
  }
  for (const card of hand) {
    const meldIndex = table.findIndex((meld) => addToMeld(meld, [card], { goingOut: hand.length === 1 }));
    if (meldIndex !== -1) {
      room.send("layOff", { cardIds: [card.id], meldIndex });
      return;
    }
  }
  const discardable = hand.filter((card) => canDiscard(card, table));
  if (discardable.length === 0) {
    return;
  }
  room.send("discard", discardable[Math.floor(Math.random() * discardable.length)].id);
}
