import assert from "assert";
import { advance, editGame, flush, playerOf, setupServer, withPlayers } from "./support/harness.js";

describe("PontinhoRoom return after 100", () => {
  const { connect, createRoom, startMatchWith } = setupServer();

  async function roundWhereSomeoneGoesOver100() {
    const match = await startMatchWith(["Lucas", "Ana", "Bruno"]);
    const { room, current, others } = match;
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
    await flush();
    return { ...match, passer, stayer };
  }

  it("offers the return for 15 seconds to who went over 100", async () => {
    const { room, passer, stayer, current } = await roundWhereSomeoneGoesOver100();

    assert.strictEqual(room.state.phase, "roundOver");
    assert.strictEqual(playerOf(room, passer.sessionId).awaitingReturn, true);
    assert.strictEqual(playerOf(room, stayer.sessionId).awaitingReturn, false);
    assert.strictEqual(playerOf(room, current.sessionId).awaitingReturn, false);
    assert.strictEqual(room.state.returnDuration, 15_000);
    assert.strictEqual(room.state.returnNumber, 1);
  });

  it("does not deal the next round while someone still has to choose", async () => {
    const { room } = await roundWhereSomeoneGoesOver100();

    advance(room, 8_000);

    assert.strictEqual(room.state.phase, "roundOver");
  });

  it("brings the player back with the highest score among those who stayed, and deals the next round", async () => {
    const { room, passer } = await roundWhereSomeoneGoesOver100();

    passer.send("chooseReturn", { back: true });
    await room.waitForMessage("chooseReturn");

    const returned = playerOf(room, passer.sessionId);
    assert.strictEqual(returned.points, 65);
    assert.strictEqual(returned.awaitingReturn, false);
    assert.strictEqual(returned.eliminated, false);
    assert.strictEqual(room.state.announcement, "returned");
    assert.strictEqual(room.state.announcementPlayer, passer.sessionId);
    assert.strictEqual(room.state.returnDuration, 0);

    advance(room, 8_000);
    assert.strictEqual(room.state.phase, "playing");
    assert.strictEqual(playerOf(room, passer.sessionId).cardCount, 9);
  });

  it("leaves the player out of the dispute when they choose not to return", async () => {
    const { room, passer } = await roundWhereSomeoneGoesOver100();

    passer.send("chooseReturn", { back: false });
    await room.waitForMessage("chooseReturn");

    assert.strictEqual(playerOf(room, passer.sessionId).eliminated, true);
    assert.strictEqual(playerOf(room, passer.sessionId).awaitingReturn, false);
    assert.strictEqual(room.state.announcement, "eliminated");
    assert.strictEqual(room.state.announcementPlayer, passer.sessionId);

    advance(room, 8_000);
    assert.strictEqual(room.state.phase, "playing");
    assert.strictEqual(playerOf(room, passer.sessionId).cardCount, 0);
  });

  it("brings the player back when 15 seconds go by without an answer", async () => {
    const { room, passer } = await roundWhereSomeoneGoesOver100();

    advance(room, 15_000);

    assert.strictEqual(playerOf(room, passer.sessionId).awaitingReturn, false);
    assert.strictEqual(playerOf(room, passer.sessionId).eliminated, false);
    assert.strictEqual(playerOf(room, passer.sessionId).points, 65);
    assert.strictEqual(room.state.returnDuration, 0);
  });

  it("numbers each offer", async () => {
    const { room, passer, stayer, current } = await roundWhereSomeoneGoesOver100();
    passer.send("chooseReturn", { back: true });
    await room.waitForMessage("chooseReturn");
    advance(room, 8_000);
    editGame(room, (game) => ({
      ...withPlayers(game, {
        [current.sessionId]: { hand: ["K-hearts-1"] },
        [stayer.sessionId]: { hand: ["2-clubs-1"] },
        [passer.sessionId]: { hand: ["K-clubs-1", "Q-clubs-1", "J-clubs-1", "10-clubs-1"] },
      }),
      currentTurn: current.sessionId,
      hasDrawn: true,
    }));

    current.send("discard", "K-hearts-1");
    await room.waitForMessage("discard");

    assert.strictEqual(playerOf(room, passer.sessionId).awaitingReturn, true);
    assert.strictEqual(room.state.returnNumber, 2);
    assert.strictEqual(room.state.returnDuration, 15_000);
  });

  it("ignores a return choice from a player who was not offered", async () => {
    const { room, current } = await roundWhereSomeoneGoesOver100();

    current.send("chooseReturn", { back: false });
    await room.waitForMessage("chooseReturn");

    assert.strictEqual(playerOf(room, current.sessionId).eliminated, false);
  });

  it("brings robots back right away", async () => {
    const options = { seats: 3, bots: true };
    const room = await createRoom(options);
    const human = await connect(room, "Lucas", options);
    await room.waitForNextPatch();
    editGame(room, (game) => ({
      ...withPlayers(game, {
        [human.sessionId]: { hand: ["K-spades-1"], points: 20 },
        "bot-1": { hand: ["Q-hearts-1"], points: 95 },
        "bot-2": { hand: ["5-hearts-1"], points: 60 },
      }),
      currentTurn: human.sessionId,
      hasDrawn: true,
    }));

    human.send("discard", "K-spades-1");
    await room.waitForMessage("discard");

    const robot = playerOf(room, "bot-1");
    assert.strictEqual(robot.awaitingReturn, false);
    assert.strictEqual(robot.eliminated, false);
    assert.strictEqual(robot.points, 65);
    assert.strictEqual(room.state.returnDuration, 0);
  });

  it("lets each player who went over 100 in the same round choose on their own", async () => {
    const { room, current, others } = await startMatchWith(["Lucas", "Ana", "Bruno", "Carla"]);
    const [first, second, third] = others;
    editGame(room, (game) => ({
      ...withPlayers(game, {
        [current.sessionId]: { hand: ["K-spades-1"], points: 20 },
        [first.sessionId]: { hand: ["Q-hearts-1"], points: 95 },
        [second.sessionId]: { hand: ["J-hearts-1"], points: 98 },
        [third.sessionId]: { hand: ["5-hearts-1"], points: 60 },
      }),
      hasDrawn: true,
    }));
    current.send("discard", "K-spades-1");
    await room.waitForMessage("discard");

    assert.strictEqual(playerOf(room, first.sessionId).awaitingReturn, true);
    assert.strictEqual(playerOf(room, second.sessionId).awaitingReturn, true);

    first.send("chooseReturn", { back: true });
    await room.waitForMessage("chooseReturn");
    assert.strictEqual(room.state.returnDuration, 15_000);
    second.send("chooseReturn", { back: false });
    await room.waitForMessage("chooseReturn");

    assert.strictEqual(playerOf(room, first.sessionId).points, 65);
    assert.strictEqual(playerOf(room, second.sessionId).eliminated, true);
    assert.strictEqual(room.state.returnDuration, 0);
  });

  it("refuses a return choice that is not a boolean", async () => {
    const { room, current, others } = await roundWhereSomeoneGoesOver100();

    current.send("chooseReturn", { back: "yes" } as never);
    await flush();

    assert.ok(room.clients.every((client) => client.sessionId !== current.sessionId));
    assert.ok(room.clients.some((client) => client.sessionId === others[0].sessionId));
  });
});
