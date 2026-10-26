import assert from "assert";
import { ColyseusTestServer, boot } from "@colyseus/testing";
import appConfig from "../src/app.config.js";
import type { PontinhoRoom } from "../src/rooms/PontinhoRoom.js";
import { CardState } from "@pontinho/protocol";
import errors from "../src/common/messages/errors.json" with { type: "json" };

function required<T>(value: T | undefined): T {
  assert.ok(value !== undefined);
  return value;
}

function playerOf(room: PontinhoRoom, sessionId: string) {
  return required(room.state.players.get(sessionId));
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
    return { room, clients };
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

  it("lets the current player draw and discard, then passes the turn", async () => {
    const { room, clients } = await startMatchWith(["Lucas", "Ana", "Bruno"]);
    const current = required(clients.find((client) => client.sessionId === room.state.currentTurn));

    current.send("draw");
    await room.waitForMessage("draw");
    const player = playerOf(room, current.sessionId);
    assert.strictEqual(player.cardCount, 10);

    const cardId = player.hand[0].id;
    current.send("discard", cardId);
    await room.waitForMessage("discard");

    assert.strictEqual(player.cardCount, 9);
    assert.strictEqual(required(room.state.discardTop).id, cardId);
    assert.strictEqual(room.state.currentTurn, room.state.order[2]);
  });

  it("lets the next player play right after a discard", async () => {
    const { room, clients } = await startMatchWith(["Lucas", "Ana", "Bruno"]);
    const current = required(clients.find((client) => client.sessionId === room.state.currentTurn));
    current.send("draw");
    await room.waitForMessage("draw");
    current.send("discard", playerOf(room, current.sessionId).hand[0].id);
    await room.waitForMessage("discard");
    const next = required(clients.find((client) => client.sessionId === room.state.currentTurn));

    next.send("draw");
    await room.waitForMessage("draw");

    assert.strictEqual(playerOf(room, next.sessionId).cardCount, 10);
  });

  it("plays a random card for a player who does nothing for 30 seconds", async () => {
    const { room } = await startMatchWith(["Lucas", "Ana", "Bruno"]);
    const absent = room.state.currentTurn;
    setHand(room, absent, [
      "2-hearts-1",
      "6-hearts-1",
      "10-hearts-1",
      "3-clubs-1",
      "7-clubs-1",
      "J-clubs-1",
      "4-spades-1",
      "8-spades-1",
      "Q-spades-1",
    ]);

    room.clock.currentTime -= 30_000;
    room.clock.tick();

    assert.strictEqual(room.state.lastDiscarder, absent);
    assert.strictEqual(playerOf(room, absent).cardCount, 9);
    assert.notStrictEqual(room.state.currentTurn, absent);
  });

  it("lets another player go out with the discard while the next player thinks", async () => {
    const { room, clients } = await startMatchWith(["Lucas", "Ana", "Bruno"]);
    const discarder = required(clients.find((client) => client.sessionId === room.state.currentTurn));
    discarder.send("draw");
    await room.waitForMessage("draw");
    setHand(room, discarder.sessionId, ["7-spades-2", "K-hearts-1"]);
    discarder.send("discard", "7-spades-2");
    await room.waitForMessage("discard");
    const next = required(clients.find((client) => client.sessionId === room.state.currentTurn));
    const third = required(clients.find((client) => client !== discarder && client !== next));
    setHand(room, third.sessionId, ["7-clubs-1", "7-diamonds-1", "2-hearts-1"]);

    next.send("draw");
    await room.waitForMessage("draw");
    third.send("goOut");
    await room.waitForMessage("goOut");

    assert.strictEqual(room.state.phase, "roundOver");
    assert.strictEqual(room.state.wentOut, third.sessionId);
    assert.strictEqual(playerOf(room, discarder.sessionId).roundPoints, 10);
    assert.strictEqual(playerOf(room, third.sessionId).roundPoints, 0);
  });

  it("ignores a player acting out of turn", async () => {
    const { room, clients } = await startMatchWith(["Lucas", "Ana", "Bruno"]);
    const waiting = required(clients.find((client) => client.sessionId !== room.state.currentTurn));

    waiting.send("draw");
    await room.waitForMessage("draw");

    assert.strictEqual(playerOf(room, waiting.sessionId).cardCount, 9);
  });

  function setHand(room: PontinhoRoom, sessionId: string, cardIds: string[]) {
    const hand = playerOf(room, sessionId).hand;
    hand.clear();
    for (const id of cardIds) {
      const [rank, suit] = id.split("-");
      const card = new CardState();
      card.id = id;
      card.rank = rank;
      card.suit = rank === "JOKER" ? "" : suit;
      hand.push(card);
    }
  }

  async function currentPlayerReady() {
    const { room, clients } = await startMatchWith(["Lucas", "Ana", "Bruno"]);
    const current = required(clients.find((client) => client.sessionId === room.state.currentTurn));
    return { room, current };
  }

  it("lays down a valid trinca after drawing", async () => {
    const { room, current } = await currentPlayerReady();
    current.send("draw");
    await room.waitForMessage("draw");
    setHand(room, current.sessionId, ["7-clubs-1", "7-diamonds-1", "7-spades-1", "2-hearts-1"]);

    current.send("meld", { cardIds: ["7-clubs-1", "7-diamonds-1", "7-spades-1"] });
    await room.waitForMessage("meld");

    assert.strictEqual(room.state.melds.length, 1);
    assert.strictEqual(room.state.melds[0].kind, "set");
    assert.strictEqual(playerOf(room, current.sessionId).cardCount, 1);
  });

  it("goes out by playing every card on the table, without a discard", async () => {
    const { room, current } = await currentPlayerReady();
    current.send("draw");
    await room.waitForMessage("draw");
    setHand(room, current.sessionId, ["7-clubs-1", "7-diamonds-1", "7-spades-1"]);

    current.send("meld", { cardIds: ["7-clubs-1", "7-diamonds-1", "7-spades-1"] });
    await room.waitForMessage("meld");

    assert.strictEqual(room.state.phase, "roundOver");
  });

  it("refuses cards that do not form a meld and tells the player why", async () => {
    const { room, current } = await currentPlayerReady();
    current.send("draw");
    await room.waitForMessage("draw");
    setHand(room, current.sessionId, ["7-clubs-1", "8-diamonds-1", "9-spades-1", "2-hearts-1"]);
    const reply = new Promise((resolve) => current.onMessage("invalid", resolve));

    current.send("meld", { cardIds: ["7-clubs-1", "8-diamonds-1", "9-spades-1"] });

    assert.strictEqual(await reply, errors.invalidMeld);
    assert.strictEqual(room.state.melds.length, 0);
  });

  it("lays off a card on a sequência already on the table", async () => {
    const { room, current } = await currentPlayerReady();
    current.send("draw");
    await room.waitForMessage("draw");
    setHand(room, current.sessionId, ["4-hearts-1", "5-hearts-1", "6-hearts-1", "7-hearts-1", "K-clubs-1"]);
    current.send("meld", { cardIds: ["4-hearts-1", "5-hearts-1", "6-hearts-1"] });
    await room.waitForMessage("meld");

    current.send("layOff", { cardIds: ["7-hearts-1"], meldIndex: 0 });
    await room.waitForMessage("layOff");

    assert.deepStrictEqual(room.state.melds[0].cards.map((card) => card.rank), ["4", "5", "6", "7"]);
  });

  it("takes the discard only to use it in a meld", async () => {
    const { room, current } = await currentPlayerReady();
    room["discard"] = [{ id: "7-spades-2", rank: "7", suit: "spades" }];
    setHand(room, current.sessionId, ["7-clubs-1", "7-diamonds-1", "2-hearts-1"]);

    current.send("takeDiscard", { cardIds: ["7-clubs-1", "7-diamonds-1"] });
    await room.waitForMessage("takeDiscard");

    assert.strictEqual(room.state.melds[0].cards.length, 3);
    assert.strictEqual(room.state.hasDrawn, true);
    assert.strictEqual(playerOf(room, current.sessionId).cardCount, 1);
  });

  it("goes out of turn with the free discard and ends the round", async () => {
    const { room, clients } = await startMatchWith(["Lucas", "Ana", "Bruno"]);
    const current = required(clients.find((client) => client.sessionId === room.state.currentTurn));
    const other = required(clients.find((client) => client.sessionId !== room.state.currentTurn));
    room["discard"] = [{ id: "7-spades-2", rank: "7", suit: "spades" }];
    setHand(room, other.sessionId, ["7-clubs-1", "7-diamonds-1", "4-hearts-1", "5-hearts-1", "6-hearts-1", "K-spades-1"]);
    current.send("draw");
    await room.waitForMessage("draw");

    other.send("goOut");
    await room.waitForMessage("goOut");

    assert.strictEqual(room.state.phase, "roundOver");
    assert.strictEqual(playerOf(room, other.sessionId).points, 0);
    assert.strictEqual(required(room.state.discardTop).id, "K-spades-1");
    assert.ok(playerOf(room, current.sessionId).points > 0);
  });

  it("blocks going out of turn again after a bluff, without adding points", async () => {
    const { room, clients } = await startMatchWith(["Lucas", "Ana", "Bruno"]);
    const current = required(clients.find((client) => client.sessionId === room.state.currentTurn));
    const other = required(clients.find((client) => client.sessionId !== room.state.currentTurn));
    room["discard"] = [{ id: "7-spades-2", rank: "7", suit: "spades" }];
    setHand(room, other.sessionId, ["2-clubs-1", "9-diamonds-1", "K-spades-1"]);
    current.send("draw");
    await room.waitForMessage("draw");

    other.send("goOut");
    await room.waitForMessage("goOut");

    const player = playerOf(room, other.sessionId);
    assert.strictEqual(room.state.phase, "playing");
    assert.strictEqual(player.points, 0);
    assert.strictEqual(player.bluffed, true);
    assert.notStrictEqual(room.state.announcement, "");

    room.clock.currentTime -= 5_000;
    room.clock.tick();
    assert.strictEqual(room.state.announcement, "");
  });

  it("goes out on their own turn by discarding the last card, then deals a new round", async () => {
    const { room, clients } = await startMatchWith(["Lucas", "Ana", "Bruno"]);
    const current = required(clients.find((client) => client.sessionId === room.state.currentTurn));
    current.send("draw");
    await room.waitForMessage("draw");
    setHand(room, current.sessionId, ["K-spades-1"]);

    current.send("discard", "K-spades-1");
    await room.waitForMessage("discard");
    assert.strictEqual(room.state.phase, "roundOver");

    room.clock.currentTime -= 8_000;
    room.clock.tick();
    assert.strictEqual(room.state.phase, "playing");
    assert.deepStrictEqual([...room.state.players.values()].map((player) => player.cardCount), [9, 9, 9]);
  });

  it("eliminates a player who passes 100 points", async () => {
    const { room, clients } = await startMatchWith(["Lucas", "Ana", "Bruno"]);
    const current = required(clients.find((client) => client.sessionId === room.state.currentTurn));
    const loser = required(clients.find((client) => client.sessionId !== room.state.currentTurn));
    playerOf(room, loser.sessionId).points = 95;
    current.send("draw");
    await room.waitForMessage("draw");
    setHand(room, current.sessionId, ["K-spades-1"]);

    current.send("discard", "K-spades-1");
    await room.waitForMessage("discard");

    assert.strictEqual(playerOf(room, loser.sessionId).eliminated, true);
  });

  it("does not let a player discard a joker", async () => {
    const { room, current } = await currentPlayerReady();
    current.send("draw");
    await room.waitForMessage("draw");
    setHand(room, current.sessionId, ["JOKER-1-1", "K-spades-1"]);
    const reply = new Promise((resolve) => current.onMessage("invalid", resolve));

    current.send("discard", "JOKER-1-1");

    assert.strictEqual(await reply, errors.jokerCannotBeDiscarded);
    assert.strictEqual(playerOf(room, current.sessionId).hand.length, 2);
  });

  it("does not let a player discard a card that fits a meld on the table", async () => {
    const { room, current } = await currentPlayerReady();
    current.send("draw");
    await room.waitForMessage("draw");
    setHand(room, current.sessionId, ["4-hearts-1", "5-hearts-1", "6-hearts-1", "7-hearts-1", "K-spades-1"]);
    current.send("meld", { cardIds: ["4-hearts-1", "5-hearts-1", "6-hearts-1"] });
    await room.waitForMessage("meld");
    const reply = new Promise((resolve) => current.onMessage("invalid", resolve));

    current.send("discard", "7-hearts-1");

    assert.strictEqual(await reply, errors.cardFitsTable);
    assert.strictEqual(playerOf(room, current.sessionId).hand.length, 2);
  });

  async function tableWithJoker() {
    const { room, current } = await currentPlayerReady();
    current.send("draw");
    await room.waitForMessage("draw");
    setHand(room, current.sessionId, ["4-hearts-1", "JOKER-1-1", "6-hearts-1", "5-hearts-1", "8-clubs-1", "10-clubs-1", "K-spades-1"]);
    current.send("meld", { cardIds: ["4-hearts-1", "JOKER-1-1", "6-hearts-1"] });
    await room.waitForMessage("meld");
    return { room, current };
  }

  it("swaps a joker on the table and puts it straight into a new meld", async () => {
    const { room, current } = await tableWithJoker();

    current.send("layOff", { cardIds: ["5-hearts-1"], meldIndex: 0, jokerTo: { cardIds: ["8-clubs-1", "10-clubs-1"] } });
    await room.waitForMessage("layOff");

    assert.deepStrictEqual(room.state.melds[0].cards.map((card) => card.rank), ["4", "5", "6"]);
    assert.deepStrictEqual(room.state.melds[1].cards.map((card) => card.rank), ["8", "JOKER", "10"]);
    assert.deepStrictEqual(playerOf(room, current.sessionId).hand.map((card) => card.rank), ["K"]);
  });

  it("does not swap a joker without saying where it goes", async () => {
    const { room, current } = await tableWithJoker();
    const reply = new Promise((resolve) => current.onMessage("invalid", resolve));

    current.send("layOff", { cardIds: ["5-hearts-1"], meldIndex: 0 });

    assert.strictEqual(await reply, errors.jokerNeedsPlace);
    assert.strictEqual(room.state.melds[0].cards[1].rank, "JOKER");
  });

  it("does not let the swapped joker sit at the end of a meld", async () => {
    const { room, current } = await tableWithJoker();
    const reply = new Promise((resolve) => current.onMessage("invalid", resolve));

    current.send("layOff", { cardIds: ["5-hearts-1"], meldIndex: 0, jokerTo: { meldIndex: 0, cardIds: [] } });

    assert.strictEqual(await reply, errors.jokerPlacement);
    assert.strictEqual(room.state.melds[0].cards[1].rank, "JOKER");
  });

  it("lets the swapped joker sit at the end when the player is going out", async () => {
    const { room, current } = await currentPlayerReady();
    current.send("draw");
    await room.waitForMessage("draw");
    setHand(room, current.sessionId, ["4-hearts-1", "JOKER-1-1", "6-hearts-1", "5-hearts-1", "8-clubs-1", "9-clubs-1", "K-spades-1"]);
    current.send("meld", { cardIds: ["4-hearts-1", "JOKER-1-1", "6-hearts-1"] });
    await room.waitForMessage("meld");

    current.send("layOff", { cardIds: ["5-hearts-1"], meldIndex: 0, jokerTo: { cardIds: ["8-clubs-1", "9-clubs-1"] } });
    await room.waitForMessage("layOff");

    assert.deepStrictEqual(room.state.melds[1].cards.map((card) => card.rank), ["8", "9", "JOKER"]);
    assert.deepStrictEqual(playerOf(room, current.sessionId).hand.map((card) => card.rank), ["K"]);
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

  it("ends the round without a winner when there are no cards left to draw", async () => {
    const { room, clients } = await startMatchWith(["Lucas", "Ana", "Bruno"]);
    const current = required(clients.find((client) => client.sessionId === room.state.currentTurn));
    room["stock"] = [];
    room["discard"] = [{ id: "7-spades-2", rank: "7", suit: "spades" }];

    current.send("draw");
    await room.waitForMessage("draw");

    assert.strictEqual(room.state.phase, "roundOver");
    assert.ok([...room.state.players.values()].every((player) => player.points === 0));
  });

  it("keeps the match going when an eliminated player leaves", async () => {
    const { room, clients } = await startMatchWith(["Lucas", "Ana", "Bruno", "Carla"]);
    const eliminated = clients[3];
    playerOf(room, eliminated.sessionId).eliminated = true;

    await eliminated.leave();
    await new Promise((resolve) => setTimeout(resolve, 100));

    assert.strictEqual(room.state.phase, "playing");
  });

  it("does not deal a new round after the match ended", async () => {
    const { room, clients } = await startMatchWith(["Lucas", "Ana", "Bruno"]);
    const current = required(clients.find((client) => client.sessionId === room.state.currentTurn));
    const leaver = required(clients.find((client) => client.sessionId !== room.state.currentTurn));
    current.send("draw");
    await room.waitForMessage("draw");
    setHand(room, current.sessionId, ["K-spades-1"]);
    current.send("discard", "K-spades-1");
    await room.waitForMessage("discard");

    await leaver.leave();
    await new Promise((resolve) => setTimeout(resolve, 100));
    room.clock.currentTime -= 8_000;
    room.clock.tick();

    assert.strictEqual(room.state.phase, "ended");
  });

  it("lays off fitting cards for an absent player before discarding", async () => {
    const { room, clients } = await startMatchWith(["Lucas", "Ana", "Bruno"]);
    const current = required(clients.find((client) => client.sessionId === room.state.currentTurn));
    current.send("draw");
    await room.waitForMessage("draw");
    setHand(room, current.sessionId, ["4-hearts-1", "5-hearts-1", "6-hearts-1", "7-hearts-1", "K-spades-1", "2-clubs-1"]);
    current.send("meld", { cardIds: ["4-hearts-1", "5-hearts-1", "6-hearts-1"] });
    await room.waitForMessage("meld");

    room.clock.currentTime -= 30_000;
    room.clock.tick();

    assert.strictEqual(room.state.melds[0].cards.length, 4);
    assert.strictEqual(room.state.lastDiscarder, current.sessionId);
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
