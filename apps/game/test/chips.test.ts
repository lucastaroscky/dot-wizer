import assert from "assert";
import { advance, captureLogs, editGame, flush, playerOf, readyToGoOut, required, setupServer, withHand, withPoints } from "./support/harness.js";

describe("PontinhoRoom chips", () => {
  const { api, connect, createRoom, startMatchWith } = setupServer();

  it("opens the chips match with the table and the people when the table fills", async () => {
    const { room, clients } = await startMatchWith(["Lucas", "Ana", "Bruno"]);
    await flush();

    assert.deepStrictEqual(api.startedMatches, [{ table: 1, playerIds: ["user-Lucas", "user-Ana", "user-Bruno"] }]);
    assert.strictEqual(room.state.matchId, "match-1");
    assert.strictEqual(room.state.pointValue, 1);
    assert.deepStrictEqual(clients.map((client) => playerOf(room, client.sessionId).chipsBalance), [100_000, 100_000, 100_000]);
  });

  it("does not touch the chips API in a practice match", async () => {
    const options = { seats: 3, bots: true };
    const room = await createRoom(options);
    const human = await connect(room, "Lucas", options);
    await room.waitForNextPatch();
    editGame(room, (game) => ({ ...withHand(game, human.sessionId, ["K-spades-1"]), currentTurn: human.sessionId, hasDrawn: true }));

    human.send("discard", "K-spades-1");
    await room.waitForMessage("discard");
    await flush();

    assert.strictEqual(room.state.phase, "roundOver");
    assert.deepStrictEqual([api.startedMatches, api.registeredRounds, api.finishedMatches], [[], [], []]);
    assert.strictEqual(room.state.matchId, "");
  });

  it("registers the round with the winner and what each loser held, and mirrors what was paid and received", async () => {
    const { room, current, others } = await startMatchWith(["Lucas", "Ana", "Bruno"]);
    const [first, second] = others;
    editGame(room, (game) => ({
      ...withHand(withHand(withHand(game, current.sessionId, ["K-spades-1"]), first.sessionId, ["Q-hearts-1"]), second.sessionId, ["5-hearts-1", "7-hearts-1"]),
      hasDrawn: true,
    }));

    current.send("discard", "K-spades-1");
    await room.waitForMessage("discard");
    await flush();

    assert.deepStrictEqual(api.registeredRounds, [
      {
        matchId: "match-1",
        roundNumber: 1,
        winnerId: api.userIdOf(playerOf(room, current.sessionId).name),
        losers: [
          { userId: api.userIdOf(playerOf(room, first.sessionId).name), handPoints: 10 },
          { userId: api.userIdOf(playerOf(room, second.sessionId).name), handPoints: 12 },
        ],
      },
    ]);
    const chips = [current, first, second].map((client) => {
      const { chipsResult, roundChips, chipsDeficit, chipsBalance } = playerOf(room, client.sessionId);
      return { chipsResult, roundChips, chipsDeficit, chipsBalance };
    });
    assert.deepStrictEqual(chips, [
      { chipsResult: 22, roundChips: 22, chipsDeficit: 0, chipsBalance: 100_022 },
      { chipsResult: -10, roundChips: -10, chipsDeficit: 0, chipsBalance: 99_990 },
      { chipsResult: -12, roundChips: -12, chipsDeficit: 0, chipsBalance: 99_988 },
    ]);
  });

  it("charges the players who passed 100 in the round that ended the match, and finishes the match after that round is registered", async () => {
    const { room, current, others } = await startMatchWith(["Lucas", "Ana", "Bruno"]);
    const [first, second] = others;
    const release = api.holdRounds();
    editGame(room, (game) => ({
      ...withPoints(withPoints(withHand(withHand(withHand(game, current.sessionId, ["K-spades-1"]), first.sessionId, ["Q-hearts-1"]), second.sessionId, ["Q-spades-1"]), first.sessionId, 95), second.sessionId, 95),
      hasDrawn: true,
    }));

    current.send("discard", "K-spades-1");
    await room.waitForMessage("discard");
    await flush();

    assert.strictEqual(room.state.phase, "ended");
    assert.deepStrictEqual(api.registeredRounds[0].losers.map(({ handPoints }) => handPoints), [10, 10]);
    assert.deepStrictEqual(api.finishedMatches, []);

    release();
    await flush();

    assert.deepStrictEqual(api.finishedMatches, [{ matchId: "match-1", winnerId: api.userIdOf(playerOf(room, current.sessionId).name), awardWinBonus: true }]);
  });

  it("deals the next round only after the previous one is registered, and numbers the rounds", async () => {
    const { room, clients, current } = await startMatchWith(["Lucas", "Ana", "Bruno"]);
    const release = api.holdRounds();
    editGame(room, (game) => readyToGoOut(game, current.sessionId));
    current.send("discard", "K-spades-1");
    await room.waitForMessage("discard");
    await flush();

    advance(room, 8_000);
    assert.strictEqual(room.state.phase, "roundOver");

    release();
    await flush();
    assert.strictEqual(room.state.phase, "playing");

    const next = required(clients.find((client) => client.sessionId === room.state.currentTurn));
    editGame(room, (game) => ({ ...withHand(game, next.sessionId, ["K-hearts-1"]), hasDrawn: true }));
    next.send("discard", "K-hearts-1");
    await room.waitForMessage("discard");
    await flush();

    assert.deepStrictEqual(api.registeredRounds.map(({ roundNumber }) => roundNumber), [1, 2]);
  });

  it("deals the next round 8 seconds after the round is registered when the registration was quick", async () => {
    const { room, current } = await startMatchWith(["Lucas", "Ana", "Bruno"]);
    editGame(room, (game) => readyToGoOut(game, current.sessionId));
    current.send("discard", "K-spades-1");
    await room.waitForMessage("discard");
    await flush();

    assert.strictEqual(room.state.phase, "roundOver");
    advance(room, 8_000);

    assert.strictEqual(room.state.phase, "playing");
  });

  it("mirrors the deficit of a player who could not pay everything", async () => {
    const options = { table: 2, seats: 3, bots: false };
    const room = await createRoom(options);
    const lucas = await connect(room, "Lucas", options);
    api.setBalance("Lucas", 20);
    const ana = await connect(room, "Ana", options);
    const bruno = await connect(room, "Bruno", options);
    await room.waitForNextPatch();
    editGame(room, (game) => ({
      ...withHand(withHand(withHand(game, ana.sessionId, ["K-spades-1"]), lucas.sessionId, ["Q-hearts-1"]), bruno.sessionId, ["5-hearts-1", "7-hearts-1"]),
      hasDrawn: true,
    }));

    ana.send("discard", "K-spades-1");
    await room.waitForMessage("discard");
    await flush();

    const broke = playerOf(room, lucas.sessionId);
    assert.deepStrictEqual(
      { chipsResult: broke.chipsResult, roundChips: broke.roundChips, chipsDeficit: broke.chipsDeficit, chipsBalance: broke.chipsBalance },
      { chipsResult: -20, roundChips: -20, chipsDeficit: 30, chipsBalance: 0 },
    );
    assert.strictEqual(playerOf(room, ana.sessionId).chipsResult, 80);
  });

  it("ends the match and disconnects everybody when the chips match cannot be opened", async () => {
    api.failNext("startMatch");
    const options = { table: 1, seats: 3, bots: false };
    const room = await createRoom(options);
    const first = await connect(room, "Lucas", options);
    const closed = new Promise((resolve) => first.onLeave(resolve));
    await connect(room, "Ana", options);
    await connect(room, "Bruno", options);

    assert.strictEqual(await closed, 4410);
    assert.strictEqual(room.state.phase, "ended");
    assert.deepStrictEqual(api.finishedMatches, []);
  });

  it("ends the match without a winner and disconnects everybody when a round cannot be registered", async () => {
    const { room, clients, current } = await startMatchWith(["Lucas", "Ana", "Bruno"]);
    const closed = new Promise((resolve) => clients[0].onLeave(resolve));
    api.failNext("registerRound");
    editGame(room, (game) => readyToGoOut(game, current.sessionId));

    current.send("discard", "K-spades-1");
    await room.waitForMessage("discard");

    assert.strictEqual(await closed, 4410);
    assert.strictEqual(room.state.phase, "ended");
    assert.deepStrictEqual(api.finishedMatches, [{ matchId: "match-1", winnerId: null, awardWinBonus: false }]);
  });

  it("logs which call failed, with the room, the status, the code and the attempt, when it ends the match", async () => {
    const { room, current } = await startMatchWith(["Lucas", "Ana", "Bruno"]);
    api.failNext("registerRound", 1, "serviceTokenInvalid");
    editGame(room, (game) => readyToGoOut(game, current.sessionId));
    const logs = captureLogs();

    try {
      current.send("discard", "K-spades-1");
      await room.waitForMessage("discard");
      await flush();
    } finally {
      logs.restore();
    }

    const failure = logs.calls.find((call) => call.level === "error");
    assert.deepStrictEqual(failure?.args[1], { sala: room.roomId, chamada: "registerRound", status: 401, codigo: "serviceTokenInvalid", tentativa: 1 });
  });

  it("closes an open match without a winner when the room goes away", async () => {
    const { room, clients } = await startMatchWith(["Lucas", "Ana", "Bruno"]);
    await flush();

    await room.disconnect();
    await Promise.all(clients.map(() => flush()));

    assert.deepStrictEqual(api.finishedMatches, [{ matchId: "match-1", winnerId: null, awardWinBonus: false }]);
  });
});
