import assert from "assert";
import { setupServer } from "./support/harness.js";

describe("table list", () => {
  const { api, connect, createRoom, getTables } = setupServer();

  function tableOf(body: { tables: { table: number; players: { nickname: string; photoUrl: string }[] }[] }, table: number) {
    return body.tables.find((listing) => listing.table === table);
  }

  it("lists the 7 tables with the nickname and photo of who is waiting at each", async () => {
    const online = { bots: false, table: 2 };
    const room = await createRoom(online);
    await connect(room, "Lucas", online);
    await connect(room, "Ana", online);

    const { data } = await getTables(api.addAccount("Bruno"));

    assert.deepStrictEqual(data.tables.map(({ table }: { table: number }) => table), [1, 2, 3, 4, 5, 6, 7]);
    assert.deepStrictEqual(tableOf(data, 2)?.players.map(({ nickname }) => nickname), ["Lucas", "Ana"]);
    assert.deepStrictEqual(tableOf(data, 1)?.players, []);
  });

  it("takes out who leaves the table while waiting", async () => {
    const online = { bots: false, table: 3 };
    const room = await createRoom(online);
    const lucas = await connect(room, "Lucas", online);
    await connect(room, "Ana", online);

    await lucas.leave();
    const { data } = await getTables(api.addAccount("Bruno"));

    assert.deepStrictEqual(tableOf(data, 3)?.players.map(({ nickname }) => nickname), ["Ana"]);
  });

  it("does not list a table whose match already started, nor the practice matches", async () => {
    const online = { bots: false, table: 1 };
    const room = await createRoom(online);
    for (const name of ["Lucas", "Ana", "Bruno", "Carla"]) {
      await connect(room, name, online);
    }
    const practice = { bots: true, seats: 3 };
    await connect(await createRoom(practice), "Dani", practice);

    const { data } = await getTables(api.addAccount("Edu"));

    assert.ok(data.tables.every((listing: { players: unknown[] }) => listing.players.length === 0));
  });

  it("asks for a valid token", async () => {
    const missing = await getTables().catch((error: { statusCode: number }) => error);
    const invalid = await getTables("not-a-token").catch((error: { statusCode: number; data: unknown }) => error);

    assert.strictEqual(missing.statusCode, 401);
    assert.strictEqual(invalid.statusCode, 401);
    assert.deepStrictEqual(invalid.data, { code: "invalidToken" });
  });
});
