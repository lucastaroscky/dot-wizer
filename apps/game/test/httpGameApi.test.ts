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
      body: init?.body === undefined ? undefined : JSON.parse(String(init.body)),
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
        headers: { "content-type": "application/json", "x-service-token": "secret", "x-request-id": requests[0]?.headers["x-request-id"] },
        body: { accessToken: "jwt", table: 1 },
      },
    ]);
  });

  it("checks that the API is up and accepts the service token with a GET on /internal/ping", async () => {
    const { api, requests } = setup([{ status: 200, body: { ok: true } }]);

    const response = await api.ping();

    assert.deepStrictEqual(response, { ok: true });
    assert.deepStrictEqual(
      requests.map(({ url, method, headers, body }) => ({ url, method, token: headers["x-service-token"], body })),
      [{ url: "http://api.test/internal/ping", method: "GET", token: "secret", body: undefined }],
    );
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

  it("sends a request id for correlation, a different one per call and the same one across the retries of a call", async () => {
    const { api, requests } = setup([{ status: 200, body: { matchId: "m1", lastRound: 1, players: [] } }, { status: 503 }, { status: 200, body: { matchId: "m1", lastRound: 2, players: [] } }]);

    await api.registerRound({ matchId: "m1", roundNumber: 1, winnerId: "a", losers: [] });
    await api.registerRound({ matchId: "m1", roundNumber: 2, winnerId: "a", losers: [] });

    const ids = requests.map(({ headers }) => headers["x-request-id"]);
    assert.ok(ids.every((id) => /^[0-9a-f-]{36}$/.test(id)));
    assert.notStrictEqual(ids[0], ids[1]);
    assert.strictEqual(ids[1], ids[2]);
  });

  describe("failures as GameApiError", () => {
    const envelope = { statusCode: 409, code: "playerAlreadyInMatch", message: "O jogador já está em uma partida em andamento." };

    it("reads the code from the body, names the call and keeps the raw body out of the message", async () => {
      const { api } = setup([{ status: 409, body: envelope }]);

      const error = await api.startMatch({ table: 1, playerIds: ["a", "b", "c"] }).catch((failure) => failure);

      assert.ok(error instanceof GameApiError);
      assert.deepStrictEqual({ status: error.status, code: error.code, call: error.call, attempt: error.attempt }, { status: 409, code: "playerAlreadyInMatch", call: "startMatch", attempt: 1 });
      assert.ok(!error.message.includes(envelope.message));
    });

    it("turns a network failure into status 0 and a timeout into its own code", async () => {
      const network = setup([new TypeError("fetch failed")]);
      const timeout = setup([new DOMException("The operation was aborted due to timeout", "TimeoutError")]);

      const networkError = await network.api.playerEntry({ accessToken: "jwt" }).catch((failure) => failure);
      const timeoutError = await timeout.api.playerEntry({ accessToken: "jwt" }).catch((failure) => failure);

      assert.deepStrictEqual([networkError.status, networkError.code], [0, "networkError"]);
      assert.deepStrictEqual([timeoutError.status, timeoutError.code], [0, "timeout"]);
    });

    it("marks a body that is not the API envelope as an invalid response, keeping the status", async () => {
      const { api } = setup([{ status: 502, body: "<html>Bad gateway</html>" }]);

      const error = await api.playerEntry({ accessToken: "jwt" }).catch((failure) => failure);

      assert.deepStrictEqual([error.status, error.code], [502, "invalidResponse"]);
    });

    it("counts the attempts when it gives up after retrying", async () => {
      const { api } = setup([{ status: 503, body: { ...envelope, statusCode: 503, code: "internalError" } }]);

      const error = await api.finishMatch({ matchId: "m1", winnerId: null, awardWinBonus: false }).catch((failure) => failure);

      assert.deepStrictEqual([error.call, error.code, error.attempt], ["finishMatch", "internalError", 3]);
    });
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
