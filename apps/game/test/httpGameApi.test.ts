import assert from "assert";
import { GameApiError } from "../src/gameApi/GameApi.js";
import { createHttpGameApi } from "../src/gameApi/httpGameApi.js";

type Reply = { status: number; body?: unknown } | Error;
type SentRequest = { url: string; method: string; headers: Record<string, string>; body: unknown };

function setup(replies: Reply[]) {
  const requests: SentRequest[] = [];
  const fetchStub = async (url: string | URL | Request, init?: RequestInit) => {
    requests.push({
      url: String(url),
      method: String(init?.method),
      headers: init?.headers as Record<string, string>,
      body: JSON.parse(String(init?.body)),
    });
    const reply = replies[Math.min(requests.length, replies.length) - 1];
    if (reply instanceof Error) {
      throw reply;
    }
    return new Response(JSON.stringify(reply.body ?? {}), { status: reply.status });
  };
  const api = createHttpGameApi({ url: "http://api.test", serviceToken: "secret", fetch: fetchStub as typeof fetch, retryDelayMs: 0 });
  return { api, requests };
}

describe("httpGameApi", () => {
  it("asks the API about a player with the service token", async () => {
    const entry = { userId: "user-1", name: "Lucas", photoUrl: null, profileComplete: true, balance: 10, minimumBalance: 1_000, canJoin: false };
    const { api, requests } = setup([{ status: 200, body: entry }]);

    const response = await api.playerEntry({ accessToken: "jwt", table: 1 });

    assert.deepStrictEqual(response, entry);
    assert.deepStrictEqual(requests, [
      {
        url: "http://api.test/internal/players/entry",
        method: "POST",
        headers: { "content-type": "application/json", "x-service-token": "secret" },
        body: { accessToken: "jwt", table: 1 },
      },
    ]);
  });

  it("registers a round on the match path without repeating the match id in the body", async () => {
    const { api, requests } = setup([{ status: 200, body: { matchId: "m1", lastRound: 2, players: [] } }]);

    await api.registerRound({ matchId: "m1", roundNumber: 2, winnerId: "a", losers: [{ userId: "b", handPoints: 7 }] });

    assert.strictEqual(requests[0].url, "http://api.test/internal/matches/m1/rounds");
    assert.deepStrictEqual(requests[0].body, { roundNumber: 2, winnerId: "a", losers: [{ userId: "b", handPoints: 7 }] });
  });

  it("starts and finishes a match", async () => {
    const { api, requests } = setup([{ status: 201, body: { matchId: "m1" } }, { status: 200, body: {} }]);

    await api.startMatch({ table: 3, playerIds: ["a", "b", "c"] });
    await api.finishMatch({ matchId: "m1", winnerId: "a", awardWinBonus: false });

    assert.deepStrictEqual(
      requests.map(({ url, body }) => ({ url, body })),
      [
        { url: "http://api.test/internal/matches", body: { table: 3, playerIds: ["a", "b", "c"] } },
        { url: "http://api.test/internal/matches/m1/finish", body: { winnerId: "a", awardWinBonus: false } },
      ],
    );
  });

  it("registers the elimination of a player on the match path and retries it like a round", async () => {
    const { api, requests } = setup([{ status: 503 }, { status: 200, body: { matchId: "m1", userId: "a", eliminatedAt: "2026-11-02T00:00:00.000Z" } }]);

    await api.eliminatePlayer({ matchId: "m1", userId: "a" });

    assert.deepStrictEqual(
      requests.map(({ url, body }) => ({ url, body })),
      [
        { url: "http://api.test/internal/matches/m1/eliminations", body: { userId: "a" } },
        { url: "http://api.test/internal/matches/m1/eliminations", body: { userId: "a" } },
      ],
    );
  });

  it("raises the status of a refusal and does not retry a client error", async () => {
    const { api, requests } = setup([{ status: 409, body: { message: "saldo" } }]);

    await assert.rejects(
      api.registerRound({ matchId: "m1", roundNumber: 1, winnerId: "a", losers: [] }),
      (error) => error instanceof GameApiError && error.status === 409,
    );
    assert.strictEqual(requests.length, 1);
  });

  it("retries a round that failed on the server or on the network, up to 3 attempts", async () => {
    const { api, requests } = setup([{ status: 503 }, new TypeError("fetch failed"), { status: 200, body: { matchId: "m1", lastRound: 1, players: [] } }]);

    const response = await api.registerRound({ matchId: "m1", roundNumber: 1, winnerId: "a", losers: [] });

    assert.strictEqual(response.lastRound, 1);
    assert.strictEqual(requests.length, 3);
  });

  it("gives up after 3 failed attempts", async () => {
    const { api, requests } = setup([{ status: 503 }]);

    await assert.rejects(api.finishMatch({ matchId: "m1", winnerId: null, awardWinBonus: false }), (error) => error instanceof GameApiError && error.status === 503);
    assert.strictEqual(requests.length, 3);
  });

  it("does not retry opening a match nor asking about a player", async () => {
    const { api, requests } = setup([{ status: 503 }]);

    await assert.rejects(api.startMatch({ table: 1, playerIds: ["a", "b", "c"] }));
    await assert.rejects(api.playerEntry({ accessToken: "jwt" }));

    assert.strictEqual(requests.length, 2);
  });
});
