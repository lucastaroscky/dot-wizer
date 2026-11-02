import assert from "node:assert";
import { randomUUID } from "node:crypto";
import { createTestApp } from "../../../test/support/test-app.ts";
import type { TestApp } from "../../../test/support/test-app.ts";

describe("matches routes", () => {
  let testApp: TestApp;

  before(async () => {
    testApp = await createTestApp();
  });
  after(async () => testApp.app.close());
  beforeEach(async () => testApp.reset());

  async function playedMatch() {
    const players = [await testApp.signIn(), await testApp.signIn(), await testApp.signIn()];
    for (const [index, { headers }] of players.entries()) {
      await testApp.app.inject({ method: "PUT", url: "/profile", headers, payload: { name: `Jogador ${index + 1}`, birthDate: "1990-05-20" } });
      await testApp.app.inject({ method: "POST", url: "/store/purchases", headers, payload: { quantity: 5000 } });
    }
    const [ana, bia, caio] = players.map(({ userId }) => userId);
    const matchId = (
      await testApp.app.inject({
        method: "POST",
        url: "/internal/matches",
        headers: testApp.serviceHeaders,
        payload: { table: 2, playerIds: [ana, bia, caio] },
      })
    ).json().matchId;
    await testApp.app.inject({
      method: "POST",
      url: `/internal/matches/${matchId}/rounds`,
      headers: testApp.serviceHeaders,
      payload: { roundNumber: 1, winnerId: ana, losers: [{ userId: bia, handPoints: 10 }, { userId: caio, handPoints: 4 }] },
    });
    await testApp.app.inject({
      method: "POST",
      url: `/internal/matches/${matchId}/finish`,
      headers: testApp.serviceHeaders,
      payload: { winnerId: ana },
    });
    return { players, matchId };
  }

  it("shows the history of a match to someone who played it", async () => {
    const { players, matchId } = await playedMatch();

    const response = await testApp.app.inject({ method: "GET", url: `/matches/${matchId}`, headers: players[1].headers });

    assert.strictEqual(response.statusCode, 200);
    const history = response.json();
    assert.strictEqual(history.status, "FINISHED");
    assert.strictEqual(history.table, 2);
    assert.strictEqual(history.pointValue, 5);
    const summaries = Object.fromEntries(history.players.map((player: { userId: string }) => [player.userId, player]));
    assert.deepStrictEqual(summaries[players[0].userId], {
      userId: players[0].userId,
      name: "Jogador 1",
      startBalance: 5000,
      paid: 0,
      received: 70,
      deficitCleared: 0,
      deficit: 0,
      winBonus: 50,
      result: 70,
      finalBalance: 5120,
    });
    assert.deepStrictEqual(
      [summaries[players[1].userId].paid, summaries[players[1].userId].finalBalance],
      [50, 4950],
    );
  });

  it("hides the match from someone who did not play it", async () => {
    const { matchId } = await playedMatch();
    const outsider = await testApp.signIn();

    const response = await testApp.app.inject({ method: "GET", url: `/matches/${matchId}`, headers: outsider.headers });

    assert.strictEqual(response.statusCode, 404);
  });

  it("answers 404 for an unknown match and 400 for a malformed id", async () => {
    const { headers } = await testApp.signIn();

    const unknown = await testApp.app.inject({ method: "GET", url: `/matches/${randomUUID()}`, headers });
    const malformed = await testApp.app.inject({ method: "GET", url: "/matches/not-a-uuid", headers });

    assert.deepStrictEqual([unknown.statusCode, malformed.statusCode], [404, 400]);
  });

  it("answers 401 without a token", async () => {
    const response = await testApp.app.inject({ method: "GET", url: `/matches/${randomUUID()}` });

    assert.strictEqual(response.statusCode, 401);
  });

  it("lists the match payments in the statement of each player, with the match id", async () => {
    const { players, matchId } = await playedMatch();

    const { entries } = (await testApp.app.inject({ method: "GET", url: "/wallet/entries", headers: players[1].headers })).json();

    const payment = entries.find(({ type }: { type: string }) => type === "ROUND_PAYMENT");
    assert.deepStrictEqual([payment.amount, payment.matchId, payment.roundNumber], [-50, matchId, 1]);
  });
});
