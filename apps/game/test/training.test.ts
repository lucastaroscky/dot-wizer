import assert from "assert";
import { setupServer } from "./support/harness.js";

describe("PontinhoRoom practice match", () => {
  const { connect, createRoom } = setupServer();

  async function practice(options: object) {
    const room = await createRoom(options);
    await connect(room, "Lucas", options);
    await room.waitForNextPatch();
    return room;
  }

  it("seats up to 5 robots for a table of 6", async () => {
    const room = await practice({ bots: true, seats: 6 });

    assert.strictEqual(room.state.players.size, 6);
    assert.deepStrictEqual(room.state.order.toArray().slice(1), ["bot-1", "bot-2", "bot-3", "bot-4", "bot-5"]);
    assert.strictEqual(room.state.phase, "playing");
  });

  it("refuses fewer than 3 or more than 6 seats", async () => {
    await assert.rejects(createRoom({ bots: true, seats: 2 }));
    await assert.rejects(createRoom({ bots: true, seats: 7 }));
  });

  it("shows the flipped card when the life joker is chosen", async () => {
    const room = await practice({ bots: true, seats: 3, lifeJoker: true });

    assert.strictEqual(room.state.lifeJoker, true);
    assert.ok(room.state.flipped);
    assert.notStrictEqual(room.state.flipped.rank, "JOKER");
  });

  it("plays only with the coringão by default", async () => {
    const room = await practice({ bots: true, seats: 3 });

    assert.strictEqual(room.state.lifeJoker, false);
    assert.strictEqual(room.state.flipped, undefined);
  });

  it("never uses the life joker in a match with chips", async () => {
    const room = await createRoom({ bots: false, table: 1, lifeJoker: true });

    assert.strictEqual(room.state.lifeJoker, false);
  });
});
