import assert from "node:assert";
import errors from "../../common/messages/errors.json" with { type: "json" };
import { seedUser } from "../../../test/support/seed.ts";
import { createTestApp } from "../../../test/support/test-app.ts";
import type { TestApp } from "../../../test/support/test-app.ts";
import { testPrisma } from "../../../test/support/test-database.ts";
import { HOUSE_ACCOUNT, userAccount } from "./accounts.ts";

describe("wallet routes", () => {
  let testApp: TestApp;

  before(async () => {
    testApp = await createTestApp();
  });
  after(async () => testApp.app.close());
  beforeEach(async () => {
    await testApp.reset();
    testApp.clock.now = new Date("2026-11-02T15:00:00Z");
  });

  async function claim(headers: { authorization: string }) {
    return testApp.app.inject({ method: "POST", url: "/wallet/daily-bonus", headers });
  }

  async function getWallet(headers: { authorization: string }) {
    return (await testApp.app.inject({ method: "GET", url: "/wallet", headers })).json();
  }

  it("starts with an empty wallet and the daily bonus available", async () => {
    const { headers } = await testApp.signIn();

    assert.deepStrictEqual(await getWallet(headers), { balance: 0, dailyBonusAvailable: true });
  });

  it("answers 401 without a token", async () => {
    const response = await testApp.app.inject({ method: "GET", url: "/wallet" });

    assert.strictEqual(response.statusCode, 401);
  });

  it("credits 100 chips once per Brasilia day", async () => {
    const { headers } = await testApp.signIn();

    const first = await claim(headers);
    const second = await claim(headers);

    assert.strictEqual(first.statusCode, 200);
    assert.deepStrictEqual(first.json(), { amount: 100, balance: 100 });
    assert.strictEqual(second.statusCode, 409);
    assert.strictEqual(second.json().message, errors.wallet.dailyBonusAlreadyClaimed);
    assert.deepStrictEqual(await getWallet(headers), { balance: 100, dailyBonusAvailable: false });
  });

  it("allows another claim when the Brasilia calendar day changes, not the UTC day", async () => {
    const { headers } = await testApp.signIn();
    testApp.clock.now = new Date("2026-11-03T02:00:00Z");
    await claim(headers);

    testApp.clock.now = new Date("2026-11-03T04:00:00Z");
    const sameBrasiliaDay = await claim(headers);
    testApp.clock.now = new Date("2026-11-03T12:00:00Z");
    const nextBrasiliaDay = await claim(headers);

    assert.strictEqual(sameBrasiliaDay.statusCode, 200);
    assert.strictEqual(nextBrasiliaDay.statusCode, 409);
  });

  it("pays the bonus only once when the same claim arrives twice at the same time", async () => {
    const { userId, headers } = await testApp.signIn();

    const responses = await Promise.all([claim(headers), claim(headers), claim(headers)]);

    assert.deepStrictEqual(responses.map(({ statusCode }) => statusCode).sort(), [200, 409, 409]);
    assert.strictEqual(await testPrisma.walletEntry.count({ where: { toAccount: userAccount({ userId }) } }), 1);
  });

  it("does not give one user's bonus to another", async () => {
    const ana = await testApp.signIn();
    const bia = await testApp.signIn();

    await claim(ana.headers);

    assert.strictEqual((await getWallet(bia.headers)).balance, 0);
    assert.strictEqual((await claim(bia.headers)).statusCode, 200);
  });

  describe("statement", () => {
    async function seedStatement(userId: string) {
      const account = userAccount({ userId });
      const entries = [
        { fromAccount: HOUSE_ACCOUNT, toAccount: account, amount: 1000, type: "PURCHASE" as const },
        { fromAccount: HOUSE_ACCOUNT, toAccount: account, amount: 100, type: "DAILY_BONUS" as const },
        { fromAccount: account, toAccount: userAccount({ userId: "other" }), amount: 30, type: "ROUND_PAYMENT" as const },
        { fromAccount: account, toAccount: HOUSE_ACCOUNT, amount: 5, type: "DEFICIT_OFFSET" as const },
        { fromAccount: HOUSE_ACCOUNT, toAccount: account, amount: 50, type: "WIN_BONUS" as const },
      ];
      for (const [index, entry] of entries.entries()) {
        await testPrisma.walletEntry.create({
          data: { ...entry, idempotencyKey: `seed:${userId}:${index}`, createdAt: new Date(Date.UTC(2026, 10, 1, 12, index)) },
        });
      }
    }

    it("lists the newest entries first, with positive amounts received and negative amounts paid", async () => {
      const { userId, headers } = await testApp.signIn();
      await testApp.app.inject({ method: "GET", url: "/wallet", headers });
      await seedStatement(userId);

      const response = await testApp.app.inject({ method: "GET", url: "/wallet/entries", headers });

      const { entries, nextCursor } = response.json();
      assert.strictEqual(response.statusCode, 200);
      assert.deepStrictEqual(entries.map(({ type, amount }: { type: string; amount: number }) => [type, amount]), [
        ["WIN_BONUS", 50],
        ["DEFICIT_OFFSET", -5],
        ["ROUND_PAYMENT", -30],
        ["DAILY_BONUS", 100],
        ["PURCHASE", 1000],
      ]);
      assert.strictEqual(nextCursor, null);
    });

    it("pages through the statement without repeating or skipping entries", async () => {
      const { userId, headers } = await testApp.signIn();
      await seedStatement(userId);

      const first = (await testApp.app.inject({ method: "GET", url: "/wallet/entries?limit=2", headers })).json();
      const second = (
        await testApp.app.inject({ method: "GET", url: `/wallet/entries?limit=2&cursor=${first.nextCursor}`, headers })
      ).json();
      const third = (
        await testApp.app.inject({ method: "GET", url: `/wallet/entries?limit=2&cursor=${second.nextCursor}`, headers })
      ).json();

      const types = [...first.entries, ...second.entries, ...third.entries].map(({ type }: { type: string }) => type);
      assert.deepStrictEqual(types, ["WIN_BONUS", "DEFICIT_OFFSET", "ROUND_PAYMENT", "DAILY_BONUS", "PURCHASE"]);
      assert.strictEqual(first.entries.length, 2);
      assert.strictEqual(third.entries.length, 1);
      assert.strictEqual(third.nextCursor, null);
    });

    it("shows only the entries of the user who asks", async () => {
      const ana = await testApp.signIn();
      const bia = await testApp.signIn();
      await seedStatement(ana.userId);

      const response = await testApp.app.inject({ method: "GET", url: "/wallet/entries", headers: bia.headers });

      assert.deepStrictEqual(response.json().entries, []);
    });

    it("rejects a page size out of range and unknown query fields", async () => {
      const { headers } = await testApp.signIn();

      const tooBig = await testApp.app.inject({ method: "GET", url: "/wallet/entries?limit=101", headers });
      const zero = await testApp.app.inject({ method: "GET", url: "/wallet/entries?limit=0", headers });
      const unknown = await testApp.app.inject({ method: "GET", url: "/wallet/entries?userId=x", headers });

      assert.deepStrictEqual([tooBig.statusCode, zero.statusCode, unknown.statusCode], [400, 400, 400]);
    });

    it("never exposes the accounts or the idempotency key", async () => {
      const { userId, headers } = await testApp.signIn();
      await seedStatement(userId);

      const { entries } = (await testApp.app.inject({ method: "GET", url: "/wallet/entries", headers })).json();

      assert.deepStrictEqual(Object.keys(entries[0]).sort(), ["amount", "createdAt", "id", "matchId", "roundNumber", "type"]);
    });
  });

  describe("ledger guarantees in the database", () => {
    it("refuses to change or remove an entry once written", async () => {
      const userId = await seedUser({ balance: 500 });

      await assert.rejects(
        testPrisma.walletEntry.updateMany({ where: { toAccount: userAccount({ userId }) }, data: { amount: 999 } }),
        /immutable/,
      );
      await assert.rejects(
        testPrisma.walletEntry.deleteMany({ where: { toAccount: userAccount({ userId }) } }),
        /immutable/,
      );
    });

    it("refuses an entry with no value or from an account to itself", async () => {
      const base = { type: "PURCHASE" as const, idempotencyKey: "k" };

      await assert.rejects(
        testPrisma.walletEntry.create({ data: { ...base, fromAccount: "house", toAccount: "user:a", amount: 0 } }),
        /amount_positive/,
      );
      await assert.rejects(
        testPrisma.walletEntry.create({ data: { ...base, idempotencyKey: "k2", fromAccount: "house", toAccount: "house", amount: 5 } }),
        /distinct_accounts/,
      );
    });

    it("refuses two entries with the same idempotency key", async () => {
      const entry = { fromAccount: "house", toAccount: "user:a", amount: 5, type: "PURCHASE" as const, idempotencyKey: "same" };
      await testPrisma.walletEntry.create({ data: entry });

      await assert.rejects(testPrisma.walletEntry.create({ data: entry }), /Unique constraint/);
    });
  });
});
