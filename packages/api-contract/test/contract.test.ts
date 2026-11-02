import assert from "node:assert";
import { randomUUID } from "node:crypto";
import {
  buyBodySchema,
  quoteQuerySchema,
  registerRoundBodySchema,
  saveProfileBodySchema,
  startMatchBodySchema,
  playerEntryBodySchema,
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
});
