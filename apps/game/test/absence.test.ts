import assert from "assert";
import type { Room } from "@colyseus/sdk";
import { cardById } from "@pontinho/rules";
import { advance, editGame, eventually, flush, playerOf, readyToGoOut, required, roomStillExists, setupServer, withHand, withPlayers } from "./support/harness.js";

async function drop(client: Room) {
  client.reconnection.enabled = false;
  await client.leave(false);
  await flush();
}

describe("PontinhoRoom players who drop or leave", () => {
  const { api, connect, connectWith, createRoom, reconnect, startMatchWith } = setupServer();

  function engineOf(room: Awaited<ReturnType<typeof startMatchWith>>["room"], sessionId: string) {
    return required(required(room["game"]).players.find((player) => player.id === sessionId));
  }

  it("keeps the match going and marks a player who lost the connection as reconnecting", async () => {
    const { room, others } = await startMatchWith(["Lucas", "Ana", "Bruno"]);

    await drop(others[0]);

    assert.strictEqual(room.state.phase, "playing");
    assert.strictEqual(playerOf(room, others[0].sessionId).connection, "reconnecting");
  });

  it("gives the turn of a player who lost the connection 3 seconds", async () => {
    const { room, current } = await startMatchWith(["Lucas", "Ana", "Bruno"]);

    await drop(current);

    assert.strictEqual(room.state.currentTurn, current.sessionId);
    assert.strictEqual(room.state.turnDuration, 3_000);
  });

  it("goes back to connected, with the 30 second turn again, when the player reconnects in time", async () => {
    const { room, current } = await startMatchWith(["Lucas", "Ana", "Bruno"]);
    const reconnectionToken = current.reconnectionToken;
    await drop(current);
    const turnNumber = room.state.turnNumber;

    await reconnect(reconnectionToken);
    await flush();

    assert.strictEqual(playerOf(room, current.sessionId).connection, "connected");
    assert.strictEqual(room.state.turnDuration, 30_000);
    assert.ok(room.state.turnNumber > turnNumber);
  });

  it("marks the player as left once the 2 minutes are over, and still lets him come back", async () => {
    const { room, others } = await startMatchWith(["Lucas", "Ana", "Bruno"]);
    const reconnectionToken = others[0].reconnectionToken;
    await drop(others[0]);

    advance(room, 120_000);
    await flush();
    assert.strictEqual(playerOf(room, others[0].sessionId).connection, "left");
    assert.strictEqual(engineOf(room, others[0].sessionId).leftMatch, true);

    await reconnect(reconnectionToken);
    await flush();
    assert.strictEqual(playerOf(room, others[0].sessionId).connection, "connected");
    assert.strictEqual(engineOf(room, others[0].sessionId).leftMatch, false);
  });

  it("keeps the seat of a player who pressed Leave, so he can come back", async () => {
    const { room, others } = await startMatchWith(["Lucas", "Ana", "Bruno"]);
    const reconnectionToken = others[0].reconnectionToken;

    await others[0].leave();
    await flush();
    assert.strictEqual(playerOf(room, others[0].sessionId).connection, "left");
    assert.strictEqual(room.state.phase, "playing");

    const back = await reconnect(reconnectionToken);
    await flush();
    assert.strictEqual(back.sessionId, others[0].sessionId);
    assert.strictEqual(playerOf(room, others[0].sessionId).connection, "connected");
  });

  it("gives the turn of a player who left 3 seconds, starting with the turn he was in", async () => {
    const { room, current } = await startMatchWith(["Lucas", "Ana", "Bruno"]);

    await current.leave();
    await flush();

    assert.strictEqual(room.state.currentTurn, current.sessionId);
    assert.strictEqual(room.state.turnDuration, 3_000);
    advance(room, 3_000);
    assert.notStrictEqual(room.state.currentTurn, current.sessionId);
  });

  it("only discards for a person who is offline, after 3 seconds, without laying down melds", async () => {
    const { room, current } = await startMatchWith(["Lucas", "Ana", "Bruno"]);
    await drop(current);
    editGame(room, (game) => ({ ...withHand(game, current.sessionId, ["7-hearts-1", "7-clubs-1", "7-spades-1", "2-clubs-1"]), hasDrawn: true }));

    advance(room, 3_000);

    assert.strictEqual(room.state.melds.length, 0);
    assert.strictEqual(playerOf(room, current.sessionId).cardCount, 3);
    assert.notStrictEqual(room.state.currentTurn, current.sessionId);
  });

  it("opens the window to go out with the previous discard during the 3 seconds of an offline person's turn", async () => {
    const { room, clients, current } = await startMatchWith(["Lucas", "Ana", "Bruno"]);
    const nextId = room.state.order[(room.state.order.indexOf(current.sessionId) + 1) % 3];
    const next = required(clients.find((client) => client.sessionId === nextId));
    const outsider = required(clients.find((client) => client !== current && client !== next));
    await drop(next);
    editGame(room, (game) => ({ ...withPlayers(game, { [current.sessionId]: { hand: ["7-spades-2", "2-clubs-1"] }, [outsider.sessionId]: { hand: ["7-hearts-1", "7-clubs-1"] } }), hasDrawn: true }));

    current.send("discard", "7-spades-2");
    await room.waitForMessage("discard");
    assert.strictEqual(room.state.currentTurn, next.sessionId);
    assert.strictEqual(playerOf(room, next.sessionId).cardCount, 10);
    outsider.send("goOut");
    await room.waitForMessage("goOut");

    assert.strictEqual(room.state.phase, "roundOver");
    assert.strictEqual(room.state.wentOut, outsider.sessionId);
  });

  it("opens the same window when a person runs out of time: the draw comes first, the rest 3 seconds later", async () => {
    const { room, clients, current } = await startMatchWith(["Lucas", "Ana", "Bruno"]);
    const lastDiscarder = room.state.order[(room.state.order.indexOf(current.sessionId) + 2) % 3];
    const outsider = required(clients.find((client) => client !== current && client.sessionId !== lastDiscarder));
    editGame(room, (game) => ({ ...withPlayers(game, { [outsider.sessionId]: { hand: ["7-hearts-1", "7-clubs-1"] } }), discard: [cardById("7-spades-2")], lastDiscarder }));

    advance(room, 30_000);
    outsider.send("goOut");
    await room.waitForMessage("goOut");

    assert.strictEqual(room.state.phase, "roundOver");
    assert.strictEqual(room.state.wentOut, outsider.sessionId);
  });

  it("keeps a player who left in the round in progress and sits him out of the next one", async () => {
    const { room, current, others } = await startMatchWith(["Lucas", "Ana", "Bruno"]);
    await others[0].leave();
    await flush();
    editGame(room, (game) => readyToGoOut(game, current.sessionId));

    current.send("discard", "K-spades-1");
    await room.waitForMessage("discard");
    await flush();
    assert.strictEqual(room.state.phase, "roundOver");
    assert.ok(playerOf(room, others[0].sessionId).roundPoints > 0);
    assert.strictEqual(api.registeredRounds[0].losers.length, 2);

    advance(room, 8_000);
    assert.strictEqual(room.state.phase, "playing");
    assert.strictEqual(playerOf(room, others[0].sessionId).cardCount, 0);
    assert.strictEqual(playerOf(room, others[0].sessionId).sittingOut, true);
    assert.strictEqual(playerOf(room, others[1].sessionId).cardCount, 9);
  });

  it("deals a player who comes back during the break in the next round", async () => {
    const { room, current, others } = await startMatchWith(["Lucas", "Ana", "Bruno"]);
    const reconnectionToken = others[0].reconnectionToken;
    await others[0].leave();
    await flush();
    editGame(room, (game) => readyToGoOut(game, current.sessionId));
    current.send("discard", "K-spades-1");
    await room.waitForMessage("discard");
    await flush();

    await reconnect(reconnectionToken);
    await flush();
    advance(room, 8_000);

    assert.strictEqual(playerOf(room, others[0].sessionId).cardCount, 9);
    assert.strictEqual(playerOf(room, others[0].sessionId).sittingOut, false);
  });

  it("ends the match after the round in progress when the others left, and the one who stayed wins without the bonus", async () => {
    const { room, current, others } = await startMatchWith(["Lucas", "Ana", "Bruno"]);
    await others[0].leave();
    await others[1].leave();
    await flush();
    editGame(room, (game) => readyToGoOut(game, current.sessionId));
    assert.strictEqual(room.state.phase, "playing");

    current.send("discard", "K-spades-1");
    await room.waitForMessage("discard");
    await flush();

    assert.strictEqual(room.state.phase, "ended");
    assert.strictEqual(room.state.winner, current.sessionId);
    assert.strictEqual(room.state.announcement, "won");
    assert.strictEqual(api.registeredRounds.length, 1);
    assert.deepStrictEqual(api.finishedMatches, [{ matchId: "match-1", winnerId: api.userIdOf(playerOf(room, current.sessionId).name), awardWinBonus: false }]);
  });

  it("plays the round to the end with 3 second turns and ends without a winner when every person left", async () => {
    const { room, clients } = await startMatchWith(["Lucas", "Ana", "Bruno"]);
    for (const client of clients) {
      await client.leave();
    }
    await flush();
    assert.strictEqual(room.state.phase, "playing");
    editGame(room, (game) => readyToGoOut(game, game.currentTurn));

    advance(room, 3_000);
    await flush();

    assert.strictEqual(room.state.phase, "ended");
    assert.strictEqual(api.registeredRounds.length, 1);
    assert.deepStrictEqual(api.finishedMatches, [{ matchId: "match-1", winnerId: null, awardWinBonus: false }]);
  });

  it("plays the whole turn, laying down melds and going out, when no person is left connected, so the round can end", async () => {
    const { room, clients, current } = await startMatchWith(["Lucas", "Ana", "Bruno"]);
    for (const client of clients) {
      await client.leave();
    }
    await flush();
    editGame(room, (game) => ({
      ...withPlayers(game, {
        [current.sessionId]: { hand: ["7-hearts-1", "7-clubs-1", "7-spades-1"] },
        ...Object.fromEntries(game.players.filter((player) => player.id !== current.sessionId).map((player) => [player.id, { hand: ["2-clubs-1"] }])),
      }),
      currentTurn: current.sessionId,
      hasDrawn: true,
    }));

    advance(room, 3_000);
    await flush();

    assert.strictEqual(room.state.phase, "ended");
    assert.strictEqual(api.registeredRounds.length, 1);
    assert.strictEqual(api.registeredRounds[0].winnerId, api.userIdOf(playerOf(room, current.sessionId).name));
    assert.deepStrictEqual(api.finishedMatches, [{ matchId: "match-1", winnerId: null, awardWinBonus: false }]);
  });

  it("plays the whole turn too when every person is only reconnecting", async () => {
    const { room, clients, current } = await startMatchWith(["Lucas", "Ana", "Bruno"]);
    for (const client of clients) {
      await drop(client);
    }
    editGame(room, (game) => ({ ...withHand(game, current.sessionId, ["7-hearts-1", "7-clubs-1", "7-spades-1", "2-clubs-1"]), currentTurn: current.sessionId, hasDrawn: true }));

    advance(room, 3_000);

    assert.strictEqual(room.state.melds.length, 1);
  });

  it("does not end the match in the middle of the round when the last person is only reconnecting", async () => {
    const { room, clients } = await startMatchWith(["Lucas", "Ana", "Bruno"]);
    await clients[0].leave();
    await clients[1].leave();
    await drop(clients[2]);

    assert.strictEqual(room.state.phase, "playing");
    assert.deepStrictEqual(api.finishedMatches, []);
  });

  it("brings an absent player back right away when the return is offered", async () => {
    const { room, current, others } = await startMatchWith(["Lucas", "Ana", "Bruno"]);
    const [passer, stayer] = others;
    await drop(passer);
    editGame(room, (game) => ({
      ...withPlayers(game, {
        [current.sessionId]: { hand: ["K-spades-1"], points: 20 },
        [passer.sessionId]: { hand: ["Q-hearts-1"], points: 95 },
        [stayer.sessionId]: { hand: ["5-hearts-1"], points: 60 },
      }),
      hasDrawn: true,
    }));

    current.send("discard", "K-spades-1");
    await room.waitForMessage("discard");

    assert.strictEqual(playerOf(room, passer.sessionId).awaitingReturn, false);
    assert.strictEqual(playerOf(room, passer.sessionId).points, 65);
  });

  it("brings a player who leaves before choosing back to the match, and keeps him out", async () => {
    const { room, current, others } = await startMatchWith(["Lucas", "Ana", "Bruno"]);
    const [passer, stayer] = others;
    editGame(room, (game) => ({
      ...withPlayers(game, {
        [current.sessionId]: { hand: ["K-spades-1"], points: 20 },
        [passer.sessionId]: { hand: ["Q-hearts-1"], points: 95 },
        [stayer.sessionId]: { hand: ["5-hearts-1"], points: 60 },
      }),
      hasDrawn: true,
    }));
    current.send("discard", "K-spades-1");
    await room.waitForMessage("discard");
    assert.strictEqual(playerOf(room, passer.sessionId).awaitingReturn, true);

    await passer.leave();
    await flush();

    assert.strictEqual(playerOf(room, passer.sessionId).awaitingReturn, false);
    assert.strictEqual(playerOf(room, passer.sessionId).points, 65);
    assert.strictEqual(playerOf(room, passer.sessionId).eliminated, false);
    advance(room, 8_000);
    assert.strictEqual(room.state.phase, "playing");
    assert.strictEqual(playerOf(room, passer.sessionId).cardCount, 0);
  });

  it("counts a dropped connection in a practice match as leaving: no seat is kept and the same account can enter another room at once", async () => {
    const options = { seats: 3, bots: true };
    const room = await createRoom(options);
    const token = api.addAccount("Lucas");
    const human = await connectWith(room, token, options);
    await room.waitForNextPatch();

    await drop(human);
    const other = await createRoom(options);
    const again = await connectWith(other, token, options);

    assert.strictEqual(playerOf(room, human.sessionId).connection, "left");
    assert.strictEqual(room.state.phase, "playing");
    assert.strictEqual(playerOf(other, again.sessionId).name, "Lucas");
  });

  it("still keeps the seat of a dropped player in a match with chips", async () => {
    const { room, others } = await startMatchWith(["Lucas", "Ana", "Bruno"]);
    const token = `token-${playerOf(room, others[0].sessionId).name}`;
    await drop(others[0]);

    const another = await createRoom({ table: 1, bots: false });

    await assert.rejects(connectWith(another, token, { table: 1, bots: false }), (error) => (error as Error).message === "alreadyInRoom");
  });

  it("plays a practice round to the end and then ends it when the only person left", async () => {
    const options = { seats: 3, bots: true };
    const room = await createRoom(options);
    const human = await connect(room, "Lucas", options);
    await room.waitForNextPatch();

    await human.leave();
    await flush();
    assert.strictEqual(room.state.phase, "playing");
    editGame(room, (game) => ({ ...readyToGoOut(game, "bot-1"), currentTurn: "bot-1" }));
    advance(room, 3_000);
    await flush();

    assert.strictEqual(room.state.phase, "ended");
    assert.deepStrictEqual(api.finishedMatches, []);
  });

  it("lets the room close when a player drops after the match ended", async () => {
    const { room, current, others } = await startMatchWith(["Lucas", "Ana", "Bruno"]);
    await others[0].leave();
    await others[1].leave();
    await flush();
    editGame(room, (game) => readyToGoOut(game, current.sessionId));
    current.send("discard", "K-spades-1");
    await room.waitForMessage("discard");
    await flush();
    assert.strictEqual(room.state.phase, "ended");

    await drop(current);
    await eventually(() => !roomStillExists(room.roomId));

    assert.strictEqual(roomStillExists(room.roomId), false);
  });
});
