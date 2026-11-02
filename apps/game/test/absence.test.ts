import assert from "assert";
import type { Room } from "@colyseus/sdk";
import { advance, editGame, flush, playerOf, setupServer, withPlayers } from "./support/harness.js";

async function drop(client: Room) {
  client.reconnection.enabled = false;
  await client.leave(false);
  await flush();
}

describe("PontinhoRoom absent players", () => {
  const { api, connect, createRoom, reconnect, startMatchWith } = setupServer();

  it("keeps the match going and marks a player who lost the connection as reconnecting", async () => {
    const { room, others } = await startMatchWith(["Lucas", "Ana", "Bruno"]);

    await drop(others[0]);

    assert.strictEqual(room.state.phase, "playing");
    assert.strictEqual(playerOf(room, others[0].sessionId).connection, "reconnecting");
  });

  it("marks the player as connected again when they reconnect in time", async () => {
    const { room, others } = await startMatchWith(["Lucas", "Ana", "Bruno"]);
    const reconnectionToken = others[0].reconnectionToken;
    await drop(others[0]);

    await reconnect(reconnectionToken);
    await flush();

    assert.strictEqual(playerOf(room, others[0].sessionId).connection, "connected");
  });

  it("marks the player as left once the 2 minutes to reconnect are over", async () => {
    const { room, others } = await startMatchWith(["Lucas", "Ana", "Bruno"]);
    await drop(others[0]);

    advance(room, 120_000);
    await flush();

    assert.strictEqual(playerOf(room, others[0].sessionId).connection, "left");
    assert.strictEqual(room.state.phase, "playing");
  });

  it("keeps the 30 second turn of a player who is still allowed to reconnect", async () => {
    const { room, current } = await startMatchWith(["Lucas", "Ana", "Bruno"]);

    await drop(current);

    assert.strictEqual(room.state.currentTurn, current.sessionId);
    assert.strictEqual(room.state.turnDuration, 30_000);
  });

  it("gives a player who left for good a 3 second turn, starting with the turn they were in", async () => {
    const { room, current } = await startMatchWith(["Lucas", "Ana", "Bruno"]);

    await current.leave();
    await flush();

    assert.strictEqual(playerOf(room, current.sessionId).connection, "left");
    assert.strictEqual(room.state.currentTurn, current.sessionId);
    assert.strictEqual(room.state.turnDuration, 3_000);

    advance(room, 3_000);
    assert.notStrictEqual(room.state.currentTurn, current.sessionId);
  });

  it("gives the later turns of a player who left for good 3 seconds too", async () => {
    const { room, clients, current } = await startMatchWith(["Lucas", "Ana", "Bruno"]);
    const nextId = room.state.order[(room.state.order.indexOf(current.sessionId) + 1) % 3];
    const next = clients.find((client) => client.sessionId === nextId);
    await next?.leave();
    await flush();

    advance(room, 30_000);

    assert.strictEqual(room.state.currentTurn, nextId);
    assert.strictEqual(room.state.turnDuration, 3_000);
  });

  it("ends the match without a winner and closes the chips match when everybody left for good", async () => {
    const { room, clients } = await startMatchWith(["Lucas", "Ana", "Bruno"]);
    await flush();

    for (const client of clients) {
      await client.leave();
    }
    await flush();

    assert.strictEqual(room.state.phase, "ended");
    assert.deepStrictEqual(api.finishedMatches, [{ matchId: "match-1", winnerId: null }]);
  });

  it("does not end the match while the last person is still allowed to reconnect", async () => {
    const { room, clients } = await startMatchWith(["Lucas", "Ana", "Bruno"]);
    await clients[0].leave();
    await clients[1].leave();
    await drop(clients[2]);

    assert.strictEqual(room.state.phase, "playing");
  });

  it("ends a practice match when the only person leaves", async () => {
    const options = { seats: 3, bots: true };
    const room = await createRoom(options);
    const human = await connect(room, "Lucas", options);
    await room.waitForNextPatch();

    await human.leave();
    await flush();

    assert.strictEqual(room.state.phase, "ended");
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
});
