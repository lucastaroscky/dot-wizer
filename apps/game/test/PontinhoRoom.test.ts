import assert from "assert";
import { ColyseusTestServer, boot } from "@colyseus/testing";
import { cardById, type Game } from "@pontinho/rules";
import appConfig from "../src/app.config.js";
import type { PontinhoRoom } from "../src/rooms/pontinho/PontinhoRoom.js";
import errors from "../src/common/messages/errors.json" with { type: "json" };
import announcements from "../src/common/messages/announcements.json" with { type: "json" };

function required<T>(value: T | undefined): T {
  assert.ok(value !== undefined);
  return value;
}

function playerOf(room: PontinhoRoom, sessionId: string) {
  return required(room.state.players.get(sessionId));
}

function editGame(room: PontinhoRoom, change: (game: Game) => Game) {
  room["game"] = change(required(room["game"]));
}

function withHand(game: Game, playerId: string, cardIds: string[]): Game {
  return { ...game, players: game.players.map((player) => (player.id === playerId ? { ...player, hand: cardIds.map(cardById) } : player)) };
}

describe("PontinhoRoom", () => {
  let colyseus: ColyseusTestServer<typeof appConfig>;

  before(async () => colyseus = await boot(appConfig));
  after(async () => colyseus.shutdown());
  beforeEach(async () => colyseus.cleanup());

  async function startMatchWith(names: string[]) {
    const room = await colyseus.createRoom<PontinhoRoom>("pontinho", { seats: names.length, bots: false });
    const clients = [];
    for (const name of names) {
      clients.push(await colyseus.connectTo(room, { name }));
    }
    await room.waitForNextPatch();
    const current = required(clients.find((client) => client.sessionId === room.state.currentTurn));
    const others = clients.filter((client) => client !== current);
    return { room, clients, current, others };
  }

  it("waits in the lobby until the table is full", async () => {
    const room = await colyseus.createRoom<PontinhoRoom>("pontinho", { seats: 3, bots: false });
    await colyseus.connectTo(room, { name: "Lucas" });
    await colyseus.connectTo(room, { name: "Ana" });

    assert.strictEqual(room.state.phase, "waiting");
  });

  it("deals 9 cards to each player as soon as the table is full", async () => {
    const { room } = await startMatchWith(["Lucas", "Ana", "Bruno"]);

    assert.strictEqual(room.state.phase, "playing");
    assert.deepStrictEqual([...room.state.players.values()].map((player) => player.cardCount), [9, 9, 9]);
    assert.strictEqual(room.state.stockCount, 108 - 27 - 1);
    assert.strictEqual(room.state.currentTurn, room.state.order[1]);
  });

  it("shows each player only their own hand", async () => {
    const { room, clients } = await startMatchWith(["Lucas", "Ana", "Bruno"]);
    const [lucas] = clients;

    const ownHand = required(lucas.state.players.get(lucas.sessionId)).hand;
    const otherHand = required(lucas.state.players.get(room.state.order[1])).hand;

    assert.strictEqual(ownHand.length, 9);
    assert.ok(!otherHand || otherHand.length === 0);
  });

  it("applies the current player's draw and discard, then passes the turn", async () => {
    const { room, current } = await startMatchWith(["Lucas", "Ana", "Bruno"]);
    editGame(room, (game) => withHand(game, current.sessionId, ["2-hearts-1", "9-clubs-1"]));

    current.send("draw");
    await room.waitForMessage("draw");
    assert.strictEqual(playerOf(room, current.sessionId).cardCount, 3);

    current.send("discard", "2-hearts-1");
    await room.waitForMessage("discard");

    assert.strictEqual(required(room.state.discardTop).id, "2-hearts-1");
    assert.strictEqual(room.state.currentTurn, room.state.order[2]);
  });

  it("ignores a player acting out of turn", async () => {
    const { room, others } = await startMatchWith(["Lucas", "Ana", "Bruno"]);

    others[0].send("draw");
    await room.waitForMessage("draw");

    assert.strictEqual(playerOf(room, others[0].sessionId).cardCount, 9);
  });

  it("tells the player why a play was refused", async () => {
    const { current } = await startMatchWith(["Lucas", "Ana", "Bruno"]);
    const reply = new Promise((resolve) => current.onMessage("invalid", resolve));

    current.send("goOut");

    assert.strictEqual(await reply, errors.notYourTurnToGoOut);
  });

  it("announces a bluff and clears the message after 5 seconds", async () => {
    const { room, current, others } = await startMatchWith(["Lucas", "Ana", "Bruno"]);
    editGame(room, (game) => ({ ...withHand(game, others[0].sessionId, ["2-clubs-1", "9-diamonds-1", "K-spades-1"]), discard: [cardById("7-spades-2")] }));
    current.send("draw");
    await room.waitForMessage("draw");

    others[0].send("goOut");
    await room.waitForMessage("goOut");
    assert.ok(room.state.announcement.includes("blefou"));
    assert.strictEqual(playerOf(room, others[0].sessionId).bluffed, true);

    room.clock.currentTime -= 5_000;
    room.clock.tick();
    assert.strictEqual(room.state.announcement, "");
  });

  it("announces who went out, shows the round points and deals a new round 8 seconds later", async () => {
    const { room, current } = await startMatchWith(["Lucas", "Ana", "Bruno"]);
    editGame(room, (game) => ({ ...withHand(game, current.sessionId, ["K-spades-1"]), hasDrawn: true }));

    current.send("discard", "K-spades-1");
    await room.waitForMessage("discard");
    assert.strictEqual(room.state.phase, "roundOver");
    assert.strictEqual(room.state.wentOut, current.sessionId);
    assert.strictEqual(room.state.announcement, announcements.wentOut.replace("{name}", playerOf(room, current.sessionId).name));
    assert.ok([...room.state.players.values()].some((player) => player.roundPoints > 0));

    room.clock.currentTime -= 8_000;
    room.clock.tick();
    assert.strictEqual(room.state.phase, "playing");
    assert.deepStrictEqual([...room.state.players.values()].map((player) => player.cardCount), [9, 9, 9]);
  });

  it("ends the round without a winner when there are no cards left to draw", async () => {
    const { room, current } = await startMatchWith(["Lucas", "Ana", "Bruno"]);
    editGame(room, (game) => ({ ...game, stock: [], discard: [cardById("7-spades-2")] }));

    current.send("draw");
    await room.waitForMessage("draw");

    assert.strictEqual(room.state.phase, "roundOver");
    assert.strictEqual(room.state.announcement, announcements.outOfCards);
  });

  it("does not deal a new round after a player left the match", async () => {
    const { room, current, others } = await startMatchWith(["Lucas", "Ana", "Bruno"]);
    editGame(room, (game) => ({ ...withHand(game, current.sessionId, ["K-spades-1"]), hasDrawn: true }));
    current.send("discard", "K-spades-1");
    await room.waitForMessage("discard");

    await others[0].leave();
    await new Promise((resolve) => setTimeout(resolve, 100));
    room.clock.currentTime -= 8_000;
    room.clock.tick();

    assert.strictEqual(room.state.phase, "ended");
    assert.strictEqual(room.state.announcement, announcements.playerLeft);
  });

  it("keeps the match going when an eliminated player leaves", async () => {
    const { room, clients } = await startMatchWith(["Lucas", "Ana", "Bruno", "Carla"]);
    const eliminated = clients[3];
    editGame(room, (game) => ({ ...game, players: game.players.map((player) => (player.id === eliminated.sessionId ? { ...player, eliminated: true } : player)) }));

    await eliminated.leave();
    await new Promise((resolve) => setTimeout(resolve, 100));

    assert.strictEqual(room.state.phase, "playing");
  });

  it("plays for a player who does nothing for 30 seconds", async () => {
    const { room, current } = await startMatchWith(["Lucas", "Ana", "Bruno"]);

    room.clock.currentTime -= 30_000;
    room.clock.tick();

    assert.notStrictEqual(room.state.currentTurn, current.sessionId);
  });

  it("survives a malformed message: only the sender is disconnected", async () => {
    const { room, clients } = await startMatchWith(["Lucas", "Ana", "Bruno"]);
    const [attacker, other] = clients;

    attacker.send("takeDiscard");
    attacker.send("layOff", { cardIds: 5, jokerTo: {} } as never);
    await new Promise((resolve) => setTimeout(resolve, 100));

    assert.strictEqual(room.state.phase, "playing");
    assert.ok(room.clients.some((client) => client.sessionId === other.sessionId));
  });

  it("refuses to create a table with fewer than 3 or more than 6 seats", async () => {
    await assert.rejects(colyseus.createRoom<PontinhoRoom>("pontinho", { seats: 2, bots: false }));
    await assert.rejects(colyseus.createRoom<PontinhoRoom>("pontinho", { seats: 7, bots: false }));
  });

  it("refuses to join with an empty or too long name", async () => {
    const room = await colyseus.createRoom<PontinhoRoom>("pontinho", { seats: 3, bots: false });

    await assert.rejects(colyseus.connectTo(room, { name: "" }));
    await assert.rejects(colyseus.connectTo(room, { name: "x".repeat(21) }));
  });

  it("fills the table with bots that play on their own", async () => {
    const room = await colyseus.createRoom<PontinhoRoom>("pontinho", { seats: 3, bots: true });
    const human = await colyseus.connectTo(room, { name: "Lucas" });
    await room.waitForNextPatch();

    assert.strictEqual(room.state.phase, "playing");
    assert.deepStrictEqual([...room.state.order].filter((id) => id !== human.sessionId), ["bot-1", "bot-2"]);

    while (room.state.currentTurn !== human.sessionId) {
      const botTurn = room.state.currentTurn;
      room.clock.currentTime -= 3_000;
      room.clock.tick();
      assert.notStrictEqual(room.state.currentTurn, botTurn);
    }
  });
});
