import assert from "assert";
import { cardById } from "@pontinho/rules";
import { advance, editGame, flush, playerOf, readyToGoOut, required, setupServer, withHand, withPlayers } from "./support/harness.js";

describe("PontinhoRoom", () => {
  const { connect, createRoom, startMatchWith } = setupServer();

  it("waits in the lobby until the table is full", async () => {
    const options = { table: 1, bots: false };
    const room = await createRoom(options);
    await connect(room, "Lucas", options);
    await connect(room, "Ana", options);

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

    assert.strictEqual(await reply, "notYourTurnToGoOut");
  });

  it("announces a bluff and clears the message after 5 seconds", async () => {
    const { room, current, others } = await startMatchWith(["Lucas", "Ana", "Bruno"]);
    editGame(room, (game) => ({ ...withHand(game, others[0].sessionId, ["2-clubs-1", "9-diamonds-1", "K-spades-1"]), discard: [cardById("7-spades-2")] }));
    current.send("draw");
    await room.waitForMessage("draw");

    others[0].send("goOut");
    await room.waitForMessage("goOut");
    assert.strictEqual(room.state.announcement, "bluffed");
    assert.strictEqual(room.state.announcementPlayer, others[0].sessionId);
    assert.strictEqual(playerOf(room, others[0].sessionId).bluffed, true);

    room.clock.currentTime -= 5_000;
    room.clock.tick();
    assert.strictEqual(room.state.announcement, "");
  });

  it("announces who went out, shows the round points and deals a new round 8 seconds later", async () => {
    const { room, current } = await startMatchWith(["Lucas", "Ana", "Bruno"]);
    editGame(room, (game) => readyToGoOut(game, current.sessionId));

    current.send("discard", "K-spades-1");
    await room.waitForMessage("discard");
    assert.strictEqual(room.state.phase, "roundOver");
    assert.strictEqual(room.state.wentOut, current.sessionId);
    assert.strictEqual(room.state.announcement, "wentOut");
    assert.strictEqual(room.state.announcementPlayer, current.sessionId);
    assert.ok([...room.state.players.values()].some((player) => player.roundPoints > 0));

    await flush();
    advance(room, 8_000);
    assert.strictEqual(room.state.phase, "playing");
    assert.deepStrictEqual([...room.state.players.values()].map((player) => player.cardCount), [9, 9, 9]);
  });

  it("announces the winner of the round when there are no cards left to draw", async () => {
    const { room, current, others } = await startMatchWith(["Lucas", "Ana", "Bruno"]);
    editGame(room, (game) => ({
      ...withPlayers(game, {
        [current.sessionId]: { hand: ["K-spades-1"], points: 50 },
        [others[0].sessionId]: { hand: ["2-clubs-1"] },
        [others[1].sessionId]: { hand: ["3-clubs-1"] },
      }),
      stock: [],
      discard: [cardById("7-spades-2")],
    }));

    current.send("draw");
    await room.waitForMessage("draw");

    assert.strictEqual(room.state.phase, "roundOver");
    assert.strictEqual(room.state.announcement, "outOfCards");
    assert.strictEqual(room.state.announcementPlayer, others[0].sessionId);
    assert.strictEqual(room.state.wentOut, others[0].sessionId);
  });

  it("keeps the match going when an eliminated player leaves", async () => {
    const { room, clients } = await startMatchWith(["Lucas", "Ana", "Bruno", "Carla"]);
    const eliminated = clients[3];
    editGame(room, (game) => ({ ...game, players: game.players.map((player) => (player.id === eliminated.sessionId ? { ...player, eliminated: true } : player)) }));

    await eliminated.leave();
    await new Promise((resolve) => setTimeout(resolve, 100));

    assert.strictEqual(room.state.phase, "playing");
  });

  it("plays for a player who does nothing for 30 seconds: draws at once, then finishes the turn 3 seconds later", async () => {
    const { room, current } = await startMatchWith(["Lucas", "Ana", "Bruno"]);

    advance(room, 30_000);
    assert.strictEqual(room.state.currentTurn, current.sessionId);
    assert.strictEqual(playerOf(room, current.sessionId).cardCount, 10);
    assert.strictEqual(room.state.turnDuration, 3_000);

    advance(room, 3_000);
    assert.notStrictEqual(room.state.currentTurn, current.sessionId);
  });

  it("lets another person go out with the previous discard while a robot waits its 3 seconds", async () => {
    const options = { seats: 3, bots: true };
    const room = await createRoom(options);
    const human = await connect(room, "Lucas", options);
    await room.waitForNextPatch();
    editGame(room, (game) => ({
      ...withHand(game, human.sessionId, ["7-hearts-1", "7-clubs-1"]),
      discard: [cardById("7-spades-2")],
      currentTurn: "bot-1",
      lastDiscarder: "bot-2",
      hasDrawn: false,
      discardIsFree: false,
    }));

    const cardsBefore = playerOf(room, "bot-1").cardCount;

    room["startTurnTimer"]();
    assert.strictEqual(playerOf(room, "bot-1").cardCount, cardsBefore + 1);
    assert.strictEqual(room.state.discardIsFree, true);
    human.send("goOut");
    await room.waitForMessage("goOut");

    assert.strictEqual(room.state.phase, "roundOver");
    assert.strictEqual(room.state.wentOut, human.sessionId);
  });

  it("only discards for a person who ran out of the 30 seconds, without laying down melds", async () => {
    const { room, current } = await startMatchWith(["Lucas", "Ana", "Bruno"]);
    editGame(room, (game) => ({ ...withHand(game, current.sessionId, ["7-hearts-1", "7-clubs-1", "7-spades-1", "2-clubs-1"]), hasDrawn: true }));

    advance(room, 30_000);

    assert.strictEqual(room.state.melds.length, 0);
    assert.strictEqual(playerOf(room, current.sessionId).cardCount, 3);
    assert.notStrictEqual(room.state.currentTurn, current.sessionId);
  });

  it("shows the winner of a practice match at once, with no chips to wait for", async () => {
    const options = { seats: 3, bots: true };
    const room = await createRoom(options);
    const human = await connect(room, "Lucas", options);
    await room.waitForNextPatch();
    editGame(room, (game) => ({
      ...withPlayers(game, {
        [human.sessionId]: { hand: ["K-spades-1"] },
        "bot-1": { hand: ["Q-hearts-1"], points: 95 },
        "bot-2": { hand: ["Q-spades-1"], points: 95 },
      }),
      currentTurn: human.sessionId,
      hasDrawn: true,
    }));

    human.send("discard", "K-spades-1");
    await room.waitForMessage("discard");

    assert.strictEqual(room.state.phase, "ended");
    assert.strictEqual(room.state.winner, human.sessionId);
    assert.strictEqual(room.state.announcement, "won");
  });

  it("keeps the robots of a practice match playing the whole turn", async () => {
    const options = { seats: 3, bots: true };
    const room = await createRoom(options);
    await connect(room, "Lucas", options);
    await room.waitForNextPatch();
    editGame(room, (game) => ({ ...withHand(game, "bot-1", ["7-hearts-1", "7-clubs-1", "7-spades-1", "2-clubs-1"]), currentTurn: "bot-1", hasDrawn: true }));

    advance(room, 3_000);

    assert.strictEqual(room.state.melds.length, 1);
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

  it("seats 4 players at a table of 4", async () => {
    const { room } = await startMatchWith(["Lucas", "Ana", "Bruno", "Carla"]);

    assert.strictEqual(room.state.phase, "playing");
    assert.deepStrictEqual([...room.state.players.values()].map((player) => player.cardCount), [9, 9, 9, 9]);
  });

  it("gives bots a 3 second turn and people a 30 second turn", async () => {
    const options = { table: 1, seats: 3, bots: true };
    const room = await createRoom(options);
    const human = await connect(room, "Lucas", options);
    await room.waitForNextPatch();

    assert.notStrictEqual(room.state.currentTurn, human.sessionId);
    assert.strictEqual(room.state.turnDuration, 3_000);
    const turnNumber = room.state.turnNumber;

    while (room.state.currentTurn !== human.sessionId) {
      room.clock.currentTime -= 3_000;
      room.clock.tick();
    }
    assert.strictEqual(room.state.turnDuration, 30_000);
    assert.ok(room.state.turnNumber > turnNumber);
  });

  it("fills the table with bots that play on their own", async () => {
    const options = { table: 1, seats: 3, bots: true };
    const room = await createRoom(options);
    const human = await connect(room, "Lucas", options);
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
