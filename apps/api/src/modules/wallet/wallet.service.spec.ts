import assert from "node:assert";
import { fake } from "../../../test/support/fake.ts";
import errors from "../../common/messages/errors.json" with { type: "json" };
import { HOUSE_ACCOUNT, userAccount } from "./accounts.ts";
import type { NewWalletEntry, WalletEntryRecord, WalletRepository } from "./repository/wallet.repository.ts";
import { WalletService } from "./wallet.service.ts";

const userId = "11111111-1111-4111-8111-111111111111";
const account = userAccount({ userId });
const matchId = "33333333-3333-4333-8333-333333333333";

function record(overrides: Partial<WalletEntryRecord> & { id: string }): WalletEntryRecord {
  return {
    fromAccount: HOUSE_ACCOUNT,
    toAccount: account,
    amount: 100,
    type: "DAILY_BONUS",
    matchId: null,
    roundNumber: null,
    createdAt: new Date("2026-11-02T12:00:00Z"),
    ...overrides,
  };
}

function buildService({
  balance = 0,
  existingKeys = [] as string[],
  entries = [] as WalletEntryRecord[],
  now = () => new Date("2026-11-02T15:00:00Z"),
} = {}) {
  const created: NewWalletEntry[] = [];
  const listCalls: unknown[] = [];
  const walletRepository = fake<WalletRepository>({
    balancesOf: async () => ({ [account]: balance }),
    existsByKey: async ({ idempotencyKey }) => existingKeys.includes(idempotencyKey),
    createEntryOnce: async ({ entry }) => {
      if (existingKeys.includes(entry.idempotencyKey)) {
        return false;
      }
      created.push(entry);
      return true;
    },
    listEntries: async (input) => {
      listCalls.push(input);
      return entries;
    },
  });
  return { service: new WalletService({ walletRepository, now }), created, listCalls };
}

describe("WalletService", () => {
  describe("getWallet", () => {
    it("returns the balance and that the daily bonus can be claimed", async () => {
      const { service } = buildService({ balance: 250 });

      assert.deepStrictEqual(await service.getWallet({ userId }), { balance: 250, dailyBonusAvailable: true });
    });

    it("says the daily bonus is not available once today's was claimed", async () => {
      const { service } = buildService({ existingKeys: [`daily:${userId}:2026-11-02`] });

      assert.strictEqual((await service.getWallet({ userId })).dailyBonusAvailable, false);
    });

    it("uses the Brasilia calendar day to find today's bonus", async () => {
      const { service } = buildService({
        existingKeys: [`daily:${userId}:2026-11-01`],
        now: () => new Date("2026-11-02T02:00:00Z"),
      });

      assert.strictEqual((await service.getWallet({ userId })).dailyBonusAvailable, false);
    });
  });

  describe("claimDailyBonus", () => {
    it("credits 100 chips from the house with the key of the Brasilia day", async () => {
      const { service, created } = buildService({ balance: 100 });

      const result = await service.claimDailyBonus({ userId });

      assert.deepStrictEqual(created, [
        {
          fromAccount: HOUSE_ACCOUNT,
          toAccount: account,
          amount: 100,
          type: "DAILY_BONUS",
          idempotencyKey: `daily:${userId}:2026-11-02`,
        },
      ]);
      assert.deepStrictEqual(result, { amount: 100, balance: 100 });
    });

    it("refuses a second claim on the same Brasilia day", async () => {
      const { service, created } = buildService({ existingKeys: [`daily:${userId}:2026-11-02`] });

      await assert.rejects(service.claimDailyBonus({ userId }), {
        statusCode: 409,
        message: errors.wallet.dailyBonusAlreadyClaimed,
      });
      assert.deepStrictEqual(created, []);
    });

    it("allows a new claim when the Brasilia day changes", async () => {
      const { service, created } = buildService({
        existingKeys: [`daily:${userId}:2026-11-01`],
        now: () => new Date("2026-11-02T03:00:00Z"),
      });

      await service.claimDailyBonus({ userId });

      assert.strictEqual(created[0].idempotencyKey, `daily:${userId}:2026-11-02`);
    });
  });

  describe("listEntries", () => {
    it("shows what the user received as positive and what the user paid as negative", async () => {
      const entries = [
        record({ id: "e2", type: "ROUND_PAYMENT", fromAccount: account, toAccount: userAccount({ userId: "x" }), amount: 30, matchId, roundNumber: 2 }),
        record({ id: "e1" }),
      ];
      const { service } = buildService({ entries });

      const page = await service.listEntries({ userId, limit: 20 });

      assert.deepStrictEqual(
        page.entries.map(({ id, amount, type, roundNumber }) => ({ id, amount, type, roundNumber })),
        [
          { id: "e2", amount: -30, type: "ROUND_PAYMENT", roundNumber: 2 },
          { id: "e1", amount: 100, type: "DAILY_BONUS", roundNumber: null },
        ],
      );
      assert.strictEqual(page.entries[0].createdAt, "2026-11-02T12:00:00.000Z");
      assert.strictEqual(page.nextCursor, null);
    });

    it("asks for one extra row and points the cursor at the last row of the page", async () => {
      const entries = [record({ id: "e3" }), record({ id: "e2" }), record({ id: "e1" })];
      const { service, listCalls } = buildService({ entries });

      const page = await service.listEntries({ userId, limit: 2, cursor: "e4" });

      assert.deepStrictEqual(listCalls, [{ account, limit: 3, cursor: "e4" }]);
      assert.deepStrictEqual(page.entries.map(({ id }) => id), ["e3", "e2"]);
      assert.strictEqual(page.nextCursor, "e2");
    });
  });

  describe("balanceOf", () => {
    it("returns zero for a user without entries", async () => {
      const { service } = buildService({ balance: 0 });

      assert.strictEqual(await service.balanceOf({ userId }), 0);
    });
  });
});
