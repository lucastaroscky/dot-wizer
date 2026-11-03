import assert from "assert";
import { advance, setupServer } from "./support/harness.js";

const ONLINE = { table: 1, bots: false };

describe("PontinhoRoom online table", () => {
  const { connect, createRoom } = setupServer();

  async function sit(names: string[]) {
    const room = await createRoom(ONLINE);
    const clients = [];
    for (const name of names) {
      clients.push(await connect(room, name, ONLINE));
    }
    return { room, clients };
  }

  it("always has 4 seats, whatever the options say", async () => {
    const room = await createRoom({ ...ONLINE, seats: 3 });

    assert.strictEqual(room.state.seats, 4);
    assert.strictEqual(room.maxClients, 4);
  });

  it("starts the match at once when the fourth person sits", async () => {
    const { room } = await sit(["Lucas", "Ana", "Bruno", "Carla"]);

    assert.strictEqual(room.state.phase, "playing");
    assert.strictEqual(room.state.countdownDuration, 0);
  });

  it("waits with 2 seated, with no countdown", async () => {
    const { room } = await sit(["Lucas", "Ana"]);
    advance(room, 10_000);

    assert.strictEqual(room.state.phase, "waiting");
    assert.strictEqual(room.state.countdownDuration, 0);
  });

  it("starts a 10 second countdown when the third person sits, and starts the match with 3 when it ends", async () => {
    const { room } = await sit(["Lucas", "Ana", "Bruno"]);
    assert.strictEqual(room.state.phase, "waiting");
    assert.strictEqual(room.state.countdownDuration, 10_000);
    assert.strictEqual(room.state.countdownNumber, 1);

    advance(room, 9_000);
    assert.strictEqual(room.state.phase, "waiting");
    advance(room, 1_000);

    assert.strictEqual(room.state.phase, "playing");
    assert.strictEqual(room.state.countdownDuration, 0);
    assert.deepStrictEqual([...room.state.players.values()].map((player) => player.cardCount), [9, 9, 9]);
  });

  it("starts at once, cancelling the countdown, when the fourth person sits during it", async () => {
    const { room } = await sit(["Lucas", "Ana", "Bruno"]);
    await connect(room, "Carla", ONLINE);

    assert.strictEqual(room.state.phase, "playing");
    assert.strictEqual(room.state.countdownDuration, 0);
    assert.strictEqual(room.state.players.size, 4);
  });

  it("stops the countdown when the table drops to 2, and counts 10 seconds again when it gets back to 3", async () => {
    const { room, clients } = await sit(["Lucas", "Ana", "Bruno"]);
    await clients[2].leave();
    await new Promise((resolve) => setTimeout(resolve, 100));

    assert.strictEqual(room.state.countdownDuration, 0);
    advance(room, 10_000);
    assert.strictEqual(room.state.phase, "waiting");

    await connect(room, "Carla", ONLINE);
    assert.strictEqual(room.state.countdownDuration, 10_000);
    assert.strictEqual(room.state.countdownNumber, 2);
    advance(room, 10_000);
    assert.strictEqual(room.state.phase, "playing");
  });
});
