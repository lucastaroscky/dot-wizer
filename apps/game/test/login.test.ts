import assert from "assert";
import { JOIN_REFUSALS, type JoinRefusal } from "@pontinho/protocol";
import { captureLogs, flush, playerOf, required, setupServer, statusOf } from "./support/harness.js";

const TABLE_ONE = { table: 1, seats: 3, bots: false };
const PRACTICE = { table: 1, seats: 3, bots: true };

function refusedWith(refusal: JoinRefusal) {
  const { code, message } = JOIN_REFUSALS[refusal];
  return (error: unknown) => {
    assert.deepStrictEqual({ code: (error as { code: number }).code, message: (error as Error).message }, { code, message });
    return true;
  };
}

describe("PontinhoRoom login", () => {
  const { api, connect, connectWith, createRoom, joinOrCreate } = setupServer();

  it("takes the player's name and photo from the profile", async () => {
    const room = await createRoom(TABLE_ONE);

    const client = await connect(room, "Lucas", TABLE_ONE);

    assert.strictEqual(playerOf(room, client.sessionId).name, "Lucas");
    assert.strictEqual(playerOf(room, client.sessionId).photoUrl, "https://photos.test/Lucas.png");
  });

  it("leaves the photo empty when the profile has none", async () => {
    const room = await createRoom(TABLE_ONE);
    const token = api.addAccount("Ana", { photoUrl: null });

    const client = await connectWith(room, token, TABLE_ONE);

    assert.strictEqual(playerOf(room, client.sessionId).photoUrl, "");
  });

  it("refuses a token the API does not know", async () => {
    const room = await createRoom(TABLE_ONE);

    await assert.rejects(connectWith(room, "token-unknown", TABLE_ONE), refusedWith("invalidToken"));
  });

  it("refuses a player without a complete profile", async () => {
    const room = await createRoom(TABLE_ONE);
    const token = api.addAccount("Ana", { profileComplete: false });

    await assert.rejects(connectWith(room, token, TABLE_ONE), refusedWith("profileIncomplete"));
  });

  it("refuses a player below the minimum balance of the table", async () => {
    const room = await createRoom({ table: 2, seats: 3, bots: false });
    const token = api.addAccount("Ana", { balance: 4_999 });

    await assert.rejects(connectWith(room, token, { table: 2, seats: 3, bots: false }), refusedWith("insufficientBalance"));
  });

  it("lets a player below the minimum balance practice against robots", async () => {
    const room = await createRoom({ table: 7, seats: 3, bots: true });
    const token = api.addAccount("Ana", { balance: 0 });

    const client = await connectWith(room, token, { table: 7, seats: 3, bots: true });

    assert.strictEqual(playerOf(room, client.sessionId).name, "Ana");
    assert.deepStrictEqual(api.playerEntries, [{ accessToken: token, table: undefined }]);
  });

  it("lets a player practice against robots without choosing a table", async () => {
    const room = await createRoom({ seats: 3, bots: true });
    const token = api.addAccount("Ana", { balance: 0 });

    const client = await connectWith(room, token, { seats: 3, bots: true });

    assert.strictEqual(playerOf(room, client.sessionId).name, "Ana");
    assert.strictEqual(room.state.table, 0);
    assert.deepStrictEqual(api.playerEntries, [{ accessToken: token, table: undefined }]);
  });

  it("refuses a room of people without a table", async () => {
    const token = api.addAccount("Ana");

    await assert.rejects(createRoom({ seats: 3, bots: false }));
    const room = await createRoom(TABLE_ONE);
    await assert.rejects(connectWith(room, token, { seats: 3, bots: false }), refusedWith("invalidOptions"));
  });

  it("refuses options that are not a table, seats and bots", async () => {
    const room = await createRoom(TABLE_ONE);
    const token = api.addAccount("Ana");

    await assert.rejects(connectWith(room, token, { table: 8, seats: 3, bots: false }), refusedWith("invalidOptions"));
    await assert.rejects(connectWith(room, token, { seats: 3 }), refusedWith("invalidOptions"));
  });

  it("tells the client when the API is unavailable", async () => {
    const room = await createRoom(TABLE_ONE);
    const token = api.addAccount("Ana");
    api.failNext("playerEntry");

    await assert.rejects(connectWith(room, token, TABLE_ONE), refusedWith("apiUnavailable"));
  });

  it("tells a disabled account apart from an API that is down", async () => {
    const room = await createRoom(TABLE_ONE);
    const token = api.addAccount("Ana");
    api.failNext("playerEntry", 1, "accountDisabled");

    await assert.rejects(connectWith(room, token, TABLE_ONE), refusedWith("accountDisabled"));
  });

  for (const [code, refusal, level] of [
    ["serviceTokenInvalid", "apiUnavailable", "error"],
    ["networkError", "apiUnavailable", "warn"],
    ["timeout", "apiUnavailable", "warn"],
    ["internalError", "apiUnavailable", "error"],
    ["tooManyRequests", "apiUnavailable", "warn"],
    ["validationFailed", "entryFailed", "error"],
    ["tableNotFound", "entryFailed", "error"],
  ] as const) {
    it(`answers ${refusal} and logs at ${level} level when the API entry fails with ${code}`, async () => {
      const room = await createRoom(TABLE_ONE);
      const token = api.addAccount("Ana");
      api.failNext("playerEntry", 1, code);
      const logs = captureLogs();

      try {
        await assert.rejects(connectWith(room, token, TABLE_ONE), refusedWith(refusal));
      } finally {
        logs.restore();
      }

      const [, details] = required(logs.calls.find((call) => call.level === level)).args;
      assert.deepStrictEqual(details, { chamada: "playerEntry", status: statusOf(code), codigo: code, tentativa: 1 });
    });
  }

  it("refuses a player who joins by room id declaring another table", async () => {
    const room = await createRoom({ table: 7, seats: 3, bots: false });
    const token = api.addAccount("Ana", { balance: 1_000 });

    await assert.rejects(connectWith(room, token, TABLE_ONE), refusedWith("invalidOptions"));
    assert.strictEqual(room.state.players.size, 0);
  });

  it("refuses a player who joins a table room declaring practice", async () => {
    const room = await createRoom({ table: 7, seats: 3, bots: false });
    const token = api.addAccount("Ana", { balance: 0 });

    await assert.rejects(connectWith(room, token, PRACTICE), refusedWith("invalidOptions"));
  });

  it("refuses an account that is already seated in the same room", async () => {
    const room = await createRoom(TABLE_ONE);
    const token = api.addAccount("Lucas");
    await connectWith(room, token, TABLE_ONE);

    await assert.rejects(connectWith(room, token, TABLE_ONE), refusedWith("alreadyInRoom"));
    assert.strictEqual(room.state.players.size, 1);
  });

  it("refuses an account that is already seated in another room", async () => {
    const first = await createRoom(TABLE_ONE);
    const second = await createRoom(TABLE_ONE);
    const token = api.addAccount("Lucas");
    await connectWith(first, token, TABLE_ONE);

    await assert.rejects(connectWith(second, token, TABLE_ONE), refusedWith("alreadyInRoom"));
  });

  it("lets the account sit again after leaving the room", async () => {
    const first = await createRoom(TABLE_ONE);
    const second = await createRoom(TABLE_ONE);
    const token = api.addAccount("Lucas");
    const client = await connectWith(first, token, TABLE_ONE);
    await client.leave();
    await flush();

    const again = await connectWith(second, token, TABLE_ONE);

    assert.strictEqual(second.state.players.size, 1);
    assert.ok(again.sessionId);
  });

  it("creates the room for the first player and seats the next ones in it, by table, seats and bots", async () => {
    const first = await joinOrCreate(api.addAccount("Lucas"), TABLE_ONE);
    const second = await joinOrCreate(api.addAccount("Ana"), TABLE_ONE);
    const otherTable = await joinOrCreate(api.addAccount("Bruno", { balance: 5_000 }), { table: 2, seats: 3, bots: false });

    assert.strictEqual(second.roomId, first.roomId);
    assert.notStrictEqual(otherTable.roomId, first.roomId);
  });

  it("refuses to create a room for a token the API does not know", async () => {
    await assert.rejects(joinOrCreate("token-unknown", TABLE_ONE), refusedWith("invalidToken"));
  });
});
