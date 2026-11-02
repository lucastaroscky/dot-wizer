import { Client, type Room } from "@colyseus/sdk";
import { addToMeld, canDiscard, cardById, findMeldInHand } from "@pontinho/rules";
import { ROOM_NAME, toMeld } from "@pontinho/protocol";
import type { PontinhoRoom } from "../src/rooms/pontinho/PontinhoRoom.js";

const SERVER_URL = "http://localhost:2567";
const PLAY_DELAY_MS = 1500;
const [table, seats] = process.argv.slice(2, 4).map(Number);
const accessTokens = process.argv.slice(4);

if (accessTokens.length === 0) {
  console.error("Uso: npm run bots -- <mesa> <vagas> <access token> [<access token> ...]");
  process.exit(1);
}

accessTokens.forEach((accessToken, index) => startBot(accessToken, `Robô ${index + 1}`));

async function startBot(accessToken: string, name: string) {
  const client = new Client(SERVER_URL);
  client.auth.token = accessToken;
  const room = await client.joinOrCreate<PontinhoRoom>(ROOM_NAME, { table, seats, bots: false });
  console.log(`${name} entrou na sala ${room.roomId}`);
  let acting = false;
  let rejoined = false;

  room.onStateChange((state) => {
    if (state.phase === "ended" && !rejoined) {
      rejoined = true;
      room.leave();
      startBot(accessToken, name);
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
  const table = room.state.melds.map((meld) => toMeld(meld));
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
