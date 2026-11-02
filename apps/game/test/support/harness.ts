import assert from "assert";
import { ColyseusTestServer, boot } from "@colyseus/testing";
import { matchMaker } from "colyseus";
import { cardById, type Game } from "@pontinho/rules";
import { createServer } from "../../src/createServer.js";
import type { PontinhoRoom } from "../../src/rooms/pontinho/PontinhoRoom.js";
import { FakeGameApi } from "./fakeGameApi.js";

export function required<T>(value: T | undefined): T {
  assert.ok(value !== undefined);
  return value;
}

export function playerOf(room: PontinhoRoom, sessionId: string) {
  return required(room.state.players.get(sessionId));
}

export function editGame(room: PontinhoRoom, change: (game: Game) => Game) {
  room["game"] = change(required(room["game"]));
}

export function withHand(game: Game, playerId: string, cardIds: string[]): Game {
  return { ...game, players: game.players.map((player) => (player.id === playerId ? { ...player, hand: cardIds.map(cardById) } : player)) };
}

type PlayerChange = { hand?: string[]; points?: number };

export function withPlayers(game: Game, changes: Record<string, PlayerChange>): Game {
  const players = game.players.map((player) => {
    const change = changes[player.id];
    if (!change) {
      return player;
    }
    return { ...player, hand: change.hand?.map(cardById) ?? player.hand, points: change.points ?? player.points };
  });
  return { ...game, players };
}

export function readyToGoOut(game: Game, playerId: string): Game {
  const players = game.players.map((player, seat) => {
    const hand = player.id === playerId ? ["K-spades-1"] : [`${seat + 2}-clubs-1`];
    return { ...player, hand: hand.map(cardById) };
  });
  return { ...game, players, hasDrawn: true };
}

export function withPoints(game: Game, playerId: string, points: number): Game {
  return { ...game, players: game.players.map((player) => (player.id === playerId ? { ...player, points } : player)) };
}

export function roomStillExists(roomId: string) {
  return matchMaker.getLocalRoomById(roomId) !== undefined;
}

export async function eventually(check: () => boolean, timeoutMs = 3_000) {
  const deadline = Date.now() + timeoutMs;
  while (!check() && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

export function flush() {
  return new Promise((resolve) => setTimeout(resolve, 100));
}

export function advance(room: PontinhoRoom, milliseconds: number) {
  room.clock.currentTime -= milliseconds;
  room.clock.tick();
}

export function setupServer() {
  const api = new FakeGameApi();
  let server: ColyseusTestServer<ReturnType<typeof createServer>>;

  before(async () => {
    server = await boot(createServer(api));
  });
  after(async () => server.shutdown());
  beforeEach(async () => {
    await server.cleanup();
    api.reset();
  });

  async function connectWith(room: PontinhoRoom, token: string, options: object) {
    server.sdk.auth.token = token;
    return server.connectTo(room, options);
  }

  async function connect(room: PontinhoRoom, name: string, options: object) {
    return connectWith(room, api.addAccount(name), options);
  }

  function createRoom(options: object) {
    return server.createRoom<PontinhoRoom>("pontinho", options);
  }

  async function startMatchWith(names: string[], table = 1) {
    const options = { table, seats: names.length, bots: false };
    const room = await createRoom(options);
    const clients = [];
    for (const name of names) {
      clients.push(await connect(room, name, options));
    }
    await room.waitForNextPatch();
    const current = required(clients.find((client) => client.sessionId === room.state.currentTurn));
    const others = clients.filter((client) => client !== current);
    return { room, clients, current, others };
  }

  function joinOrCreate(token: string, options: object) {
    server.sdk.auth.token = token;
    return server.sdk.joinOrCreate("pontinho", options);
  }

  function reconnect(reconnectionToken: string) {
    return server.sdk.reconnect(reconnectionToken);
  }

  return { api, connect, connectWith, createRoom, joinOrCreate, reconnect, startMatchWith };
}
