import assert from "assert";
import { matchMaker } from "colyseus";
import { JOIN_REFUSALS, toJoinRefusal, toReconnectionToken } from "@pontinho/protocol";
import { advance, captureLogs, editGame, flush, playerOf, readyToGoOut, setupServer, withPlayers } from "./support/harness.js";

const TABLE_ONE = { table: 1, bots: false };
const PRACTICE = { seats: 3, bots: true };

function refusalMessage(error: unknown) {
  return (error as Error).message;
}

describe("PontinhoRoom open matches", () => {
  const { api, connect, createRoom, joinOrCreate, reconnect, startMatchWith } = setupServer();

  async function matchWithOneWhoLeft() {
    const match = await startMatchWith(["Lucas", "Ana", "Bruno"]);
    const [gone] = match.others;
    const name = playerOf(match.room, gone.sessionId).name;
    const reconnectionToken = gone.reconnectionToken;
    await gone.leave();
    await flush();
    api.setOpenMatch(name, "match-1");
    return { ...match, gone, name, reconnectionToken };
  }

  it("refuses a player who has an open match and hands him the reconnection token to go back to it", async () => {
    const { name, reconnectionToken } = await matchWithOneWhoLeft();

    const error = await joinOrCreate(`token-${name}`, TABLE_ONE).then(
      () => assert.fail("a entrada deveria ser recusada"),
      (refusal) => refusal,
    );

    assert.strictEqual((error as { code: number }).code, JOIN_REFUSALS.openMatch.code);
    assert.strictEqual(toJoinRefusal(refusalMessage(error)), "openMatch");
    assert.strictEqual(toReconnectionToken(refusalMessage(error)), reconnectionToken);
  });

  it("lets him go back with that token, from another device", async () => {
    const { room, gone, name } = await matchWithOneWhoLeft();
    const error = await joinOrCreate(`token-${name}`, TABLE_ONE).catch((refusal) => refusal);

    const back = await reconnect(toReconnectionToken(refusalMessage(error)) ?? "");
    await flush();

    assert.strictEqual(back.sessionId, gone.sessionId);
    assert.strictEqual(playerOf(room, gone.sessionId).connection, "connected");
  });

  it("refuses him in practice too", async () => {
    const { name } = await matchWithOneWhoLeft();

    const error = await joinOrCreate(`token-${name}`, PRACTICE).catch((refusal) => refusal);

    assert.strictEqual(toJoinRefusal(refusalMessage(error)), "openMatch");
  });

  it("refuses without a token when the player is still sitting in the match", async () => {
    const { clients } = await startMatchWith(["Lucas", "Ana", "Bruno"]);
    api.setOpenMatch("Lucas", "match-1");

    const error = await joinOrCreate("token-Lucas", TABLE_ONE).catch((refusal) => refusal);

    assert.strictEqual(refusalMessage(error), JOIN_REFUSALS.openMatch.message);
    assert.ok(clients.length > 0);
  });

  it("closes a stuck match that no room of this server holds, and lets the account in", async () => {
    const token = api.addAccount("Ana", { openMatchId: "stuck-1" });

    const joined = await joinOrCreate(token, TABLE_ONE);

    assert.ok(joined.sessionId);
    assert.deepStrictEqual(api.finishedMatches, [{ matchId: "stuck-1", winnerId: null, awardWinBonus: false }]);
  });

  it("refuses the entry when the stuck match cannot be closed", async () => {
    const token = api.addAccount("Ana", { openMatchId: "stuck-1" });
    api.failNext("finishMatch", 3);

    const error = await joinOrCreate(token, TABLE_ONE).catch((refusal) => refusal);

    assert.strictEqual(refusalMessage(error), JOIN_REFUSALS.apiUnavailable.message);
  });

  it("no longer holds the seat once the match is over", async () => {
    const { room, current, others } = await startMatchWith(["Lucas", "Ana", "Bruno"]);
    const reconnectionToken = others[0].reconnectionToken;
    await others[0].leave();
    await others[1].leave();
    await flush();
    editGame(room, (game) => readyToGoOut(game, current.sessionId));
    current.send("discard", "K-spades-1");
    await room.waitForMessage("discard");
    await flush();
    assert.strictEqual(room.state.phase, "ended");

    await assert.rejects(reconnect(reconnectionToken));
  });

  it("closes the open matches of the instance without a winner when the server shuts down", async () => {
    const { room } = await startMatchWith(["Lucas", "Ana", "Bruno"]);
    await flush();

    room.onBeforeShutdown();
    await flush();

    assert.deepStrictEqual(api.finishedMatches, [{ matchId: "match-1", winnerId: null, awardWinBonus: false }]);
  });

  it("registers the elimination of a player who refuses to return, and keeps no seat for him", async () => {
    const { room, current, others } = await startMatchWith(["Lucas", "Ana", "Bruno"]);
    const [passer, stayer] = others;
    const reconnectionToken = passer.reconnectionToken;
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

    passer.send("chooseReturn", { back: false });
    await room.waitForMessage("chooseReturn");
    await flush();
    assert.deepStrictEqual(api.eliminations, [{ matchId: "match-1", userId: api.userIdOf(playerOf(room, passer.sessionId).name) }]);

    await passer.leave();
    await flush();
    await assert.rejects(reconnect(reconnectionToken));
    advance(room, 8_000);
    assert.strictEqual(room.state.phase, "playing");
  });

  it("does not close a match that is still being opened when another device of a seated player asks to join", async () => {
    const release = api.holdStart();
    const room = await createRoom(TABLE_ONE);
    for (const name of ["Lucas", "Ana", "Bruno"]) {
      await connect(room, name, TABLE_ONE);
    }
    advance(room, 10_000);
    api.setOpenMatch("Lucas", "match-1");

    const error = await joinOrCreate("token-Lucas", TABLE_ONE).catch((refusal) => refusal);
    release();
    await flush();

    assert.strictEqual(refusalMessage(error), JOIN_REFUSALS.openMatch.message);
    assert.deepStrictEqual(api.finishedMatches, []);
    assert.strictEqual(room.state.matchId, "match-1");
  });

  it("forgets the match that was being opened when the API refuses it", async () => {
    api.failNext("startMatch");
    const room = await createRoom(TABLE_ONE);
    const first = await connect(room, "Lucas", TABLE_ONE);
    const closed = new Promise((resolve) => first.onLeave(resolve));
    await connect(room, "Ana", TABLE_ONE);
    await connect(room, "Bruno", TABLE_ONE);
    advance(room, 10_000);
    await closed;
    api.setOpenMatch("Lucas", "stuck-9");

    const joined = await joinOrCreate("token-Lucas", TABLE_ONE);

    assert.ok(joined.sessionId);
    assert.deepStrictEqual(api.finishedMatches, [{ matchId: "stuck-9", winnerId: null, awardWinBonus: false }]);
  });

  it("logs at error level, and keeps the match going, when the elimination cannot be registered", async () => {
    const { room, current, others } = await startMatchWith(["Lucas", "Ana", "Bruno"]);
    const [passer, stayer] = others;
    api.failNext("eliminatePlayer", 1, "matchNotFound");
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
    const logs = captureLogs();

    try {
      passer.send("chooseReturn", { back: false });
      await room.waitForMessage("chooseReturn");
      await flush();
    } finally {
      logs.restore();
    }

    const failure = logs.calls.find((call) => call.level === "error");
    assert.deepStrictEqual(failure?.args[1], { sala: room.roomId, chamada: "eliminatePlayer", status: 404, codigo: "matchNotFound", tentativa: 1 });
    assert.strictEqual(room.state.phase, "roundOver");
  });

  it("keeps the match going and logs when the presence fails to remember a seat", async () => {
    const { room, others } = await startMatchWith(["Lucas", "Ana", "Bruno"]);
    const originalSet = matchMaker.presence.set;
    const originalError = console.error;
    const logged: string[] = [];
    matchMaker.presence.set = () => {
      throw new Error("presence fora do ar");
    };
    console.error = (message: string) => logged.push(message);

    try {
      await others[0].leave();
      await flush();
    } finally {
      matchMaker.presence.set = originalSet;
      console.error = originalError;
    }

    assert.strictEqual(playerOf(room, others[0].sessionId).connection, "left");
    assert.strictEqual(room.state.phase, "playing");
    assert.ok(logged.some((message) => message.includes("presence")));
  });
});
