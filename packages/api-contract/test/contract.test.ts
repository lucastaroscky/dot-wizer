import assert from "node:assert";
import { randomUUID } from "node:crypto";
import { MIN_PLAYERS, ONLINE_MAX_PLAYERS } from "@pontinho/rules";
import {
  buyBodySchema,
  buyHeadersSchema,
  IDEMPOTENCY_KEY_HEADER,
  eliminatePlayerBodySchema,
  eliminatePlayerResponseSchema,
  quoteQuerySchema,
  registerRoundBodySchema,
  saveProfileBodySchema,
  startMatchBodySchema,
  finishMatchBodySchema,
  playerEntryBodySchema,
  pingResponseSchema,
  playerEntryResponseSchema,
  quoteResponseSchema,
  walletEntriesQuerySchema,
} from "../src/index.ts";

describe("api-contract", () => {
  it("rejects extra fields in request bodies", () => {
    const result = saveProfileBodySchema.safeParse({ name: "Ana", birthDate: "2000-01-01", admin: true });

    assert.strictEqual(result.success, false);
  });

  it("trims the profile name", () => {
    const result = saveProfileBodySchema.parse({ name: "  Ana  ", birthDate: "2000-01-01" });

    assert.strictEqual(result.name, "Ana");
  });

  it("accepts purchase quantities in multiples of 1.000 from 1.000", () => {
    assert.strictEqual(buyBodySchema.safeParse({ quantity: 1000 }).success, true);
    assert.strictEqual(buyBodySchema.safeParse({ quantity: 5000 }).success, true);
  });

  it("rejects purchase quantities below the minimum or off the step", () => {
    assert.strictEqual(buyBodySchema.safeParse({ quantity: 0 }).success, false);
    assert.strictEqual(buyBodySchema.safeParse({ quantity: 500 }).success, false);
    assert.strictEqual(buyBodySchema.safeParse({ quantity: 1500 }).success, false);
  });

  it("coerces the quote quantity from the query string", () => {
    assert.deepStrictEqual(quoteQuerySchema.parse({ quantity: "3000" }), { quantity: 3000 });
  });

  it("applies the default page size and caps it", () => {
    assert.strictEqual(walletEntriesQuerySchema.parse({}).limit, 20);
    assert.strictEqual(walletEntriesQuerySchema.safeParse({ limit: "101" }).success, false);
  });

  it("requires 3 or 4 distinct players to start a match", () => {
    const [a, b, c, d, e] = Array.from({ length: 5 }, () => randomUUID());

    assert.strictEqual(startMatchBodySchema.safeParse({ table: 1, playerIds: [a, b] }).success, false);
    assert.strictEqual(startMatchBodySchema.safeParse({ table: 1, playerIds: [a, b, c] }).success, true);
    assert.strictEqual(startMatchBodySchema.safeParse({ table: 1, playerIds: [a, b, c, d] }).success, true);
    assert.strictEqual(startMatchBodySchema.safeParse({ table: 1, playerIds: [a, b, c, d, e] }).success, false);
    assert.strictEqual(startMatchBodySchema.safeParse({ table: 1, playerIds: [a, b, b] }).success, false);
  });

  it("rejects a round where the winner is also listed as a loser", () => {
    const [winnerId, loserId] = [randomUUID(), randomUUID()];

    const valid = registerRoundBodySchema.safeParse({
      roundNumber: 1,
      winnerId,
      losers: [{ userId: loserId, handPoints: 10 }],
    });
    const winnerAsLoser = registerRoundBodySchema.safeParse({
      roundNumber: 1,
      winnerId,
      losers: [{ userId: winnerId, handPoints: 10 }],
    });

    assert.strictEqual(valid.success, true);
    assert.strictEqual(winnerAsLoser.success, false);
  });

  it("accepts a player entry request with or without a table", () => {
    assert.strictEqual(playerEntryBodySchema.safeParse({ accessToken: "jwt", table: 3 }).success, true);
    assert.strictEqual(playerEntryBodySchema.safeParse({ accessToken: "jwt" }).success, true);
    assert.strictEqual(playerEntryBodySchema.safeParse({ accessToken: "jwt", table: 0 }).success, false);
  });

  it("describes the purchase limits in the quote", () => {
    const quote = { quantity: 2000, amountCents: 200_000, minimumQuantity: 1000, quantityStep: 1000, maximumQuantity: 200_000 };

    assert.deepStrictEqual(quoteResponseSchema.parse(quote), quote);
    assert.strictEqual(quoteResponseSchema.safeParse({ quantity: 2000, amountCents: 200_000 }).success, false);
  });

  it("requires the decision about the win bonus when finishing a match", () => {
    const winnerId = randomUUID();

    assert.strictEqual(finishMatchBodySchema.safeParse({ winnerId, awardWinBonus: true }).success, true);
    assert.strictEqual(finishMatchBodySchema.safeParse({ winnerId, awardWinBonus: false }).success, true);
    assert.strictEqual(finishMatchBodySchema.safeParse({ winnerId: null, awardWinBonus: false }).success, true);
    assert.strictEqual(finishMatchBodySchema.safeParse({ winnerId }).success, false);
    assert.strictEqual(finishMatchBodySchema.safeParse({ winnerId, awardWinBonus: "yes" }).success, false);
  });

  it("describes the open match of the player in the entry response", () => {
    const entry = {
      userId: randomUUID(),
      name: "Ana",
      photoUrl: null,
      profileComplete: true,
      balance: 100,
      minimumBalance: null,
      canJoin: null,
    };

    assert.strictEqual(playerEntryResponseSchema.safeParse({ ...entry, openMatchId: randomUUID() }).success, true);
    assert.strictEqual(playerEntryResponseSchema.safeParse({ ...entry, openMatchId: null }).success, true);
    assert.strictEqual(playerEntryResponseSchema.safeParse(entry).success, false);
  });

  it("takes only the id of a user to record an elimination", () => {
    const userId = randomUUID();

    assert.strictEqual(eliminatePlayerBodySchema.safeParse({ userId }).success, true);
    assert.strictEqual(eliminatePlayerBodySchema.safeParse({ userId: "not-a-uuid" }).success, false);
    assert.strictEqual(eliminatePlayerBodySchema.safeParse({ userId, reason: "left" }).success, false);
    assert.strictEqual(eliminatePlayerBodySchema.safeParse({}).success, false);
  });

  it("describes the recorded elimination", () => {
    const elimination = { matchId: randomUUID(), userId: randomUUID(), eliminatedAt: "2026-11-02T18:00:00.000Z" };

    assert.deepStrictEqual(eliminatePlayerResponseSchema.parse(elimination), elimination);
    assert.strictEqual(eliminatePlayerResponseSchema.safeParse({ ...elimination, eliminatedAt: "yesterday" }).success, false);
  });

  it("takes the player limits of an online match from the rules package", () => {
    const ids = (count: number) => Array.from({ length: count }, () => randomUUID());

    assert.strictEqual(startMatchBodySchema.safeParse({ table: 1, playerIds: ids(MIN_PLAYERS - 1) }).success, false);
    assert.strictEqual(startMatchBodySchema.safeParse({ table: 1, playerIds: ids(MIN_PLAYERS) }).success, true);
    assert.strictEqual(startMatchBodySchema.safeParse({ table: 1, playerIds: ids(ONLINE_MAX_PLAYERS) }).success, true);
    assert.strictEqual(startMatchBodySchema.safeParse({ table: 1, playerIds: ids(ONLINE_MAX_PLAYERS + 1) }).success, false);
  });

  it("requires an idempotency key in the purchase request headers and ignores the other headers", () => {
    const key = randomUUID();

    assert.strictEqual(IDEMPOTENCY_KEY_HEADER, "idempotency-key");
    assert.deepStrictEqual(buyHeadersSchema.parse({ "idempotency-key": key, authorization: "Bearer x" }), {
      "idempotency-key": key,
    });
    assert.strictEqual(buyHeadersSchema.safeParse({ authorization: "Bearer x" }).success, false);
    assert.strictEqual(buyHeadersSchema.safeParse({ "idempotency-key": "abc" }).success, false);
  });

  it("describes the answer of the service ping", () => {
    assert.deepStrictEqual(pingResponseSchema.parse({ ok: true }), { ok: true });
    assert.strictEqual(pingResponseSchema.safeParse({ ok: false }).success, false);
  });
});
