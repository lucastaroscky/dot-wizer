import assert from "node:assert";
import { fake } from "../../../test/support/fake.ts";
import errors from "../../common/messages/errors.json" with { type: "json" };
import type { UnitOfWork } from "../../common/database/database-client.ts";
import type { UsersRepository } from "../users/repository/users.repository.ts";
import { HOUSE_ACCOUNT, userAccount } from "../wallet/accounts.ts";
import type { NewWalletEntry, WalletRepository } from "../wallet/repository/wallet.repository.ts";
import type { ChargeInput, ChargeResult, PaymentProvider } from "./payment/payment-provider.ts";
import type { PurchaseRecord, PurchasesRepository } from "./repository/purchases.repository.ts";
import { StoreService } from "./store.service.ts";
import type { StoreTransaction } from "./store.service.ts";

const userId = "11111111-1111-4111-8111-111111111111";
const paidAt = new Date("2026-11-02T15:00:00Z");

function buildService({
  chargeResult = { providerTransactionId: "tx-1", status: "PAID" } as ChargeResult,
  existing = null as PurchaseRecord | null,
  markPaidResult = true,
  maxChipsPerPurchase = 200_000,
} = {}) {
  const stored: PurchaseRecord[] = [];
  const entries: NewWalletEntry[] = [];
  const charges: ChargeInput[] = [];
  const markPaidCalls: unknown[] = [];
  const attachCalls: unknown[] = [];

  const purchases = fake<PurchasesRepository>({
    create: async (input) => {
      const purchase: PurchaseRecord = {
        id: "p-1",
        userId: input.userId,
        quantity: input.quantity,
        amountCents: input.amountCents,
        status: "PENDING",
        providerTransactionId: null,
        createdAt: paidAt,
        paidAt: null,
      };
      stored.push(purchase);
      return purchase;
    },
    attachProviderTransaction: async (input) => {
      attachCalls.push(input);
    },
    findByProviderTransaction: async () => existing ?? stored[0] ?? null,
    getById: async () => existing ?? stored[0],
    markPaid: async (input) => {
      markPaidCalls.push(input);
      return markPaidResult;
    },
  });
  const wallet = fake<WalletRepository>({
    createEntries: async (input) => {
      entries.push(...input.entries);
    },
    balancesOf: async () => ({}),
  });
  const users = fake<UsersRepository>({ lockByIds: async () => undefined });
  const unitOfWork: UnitOfWork<StoreTransaction> = {
    run: (work) => work({ purchases, wallet, users }),
  };
  const paymentProvider: PaymentProvider = {
    name: "TEST",
    charge: async (input) => {
      charges.push(input);
      return chargeResult;
    },
  };
  const service = new StoreService({
    unitOfWork,
    purchasesRepository: purchases,
    paymentProvider,
    chipPriceCents: 100,
    maxChipsPerPurchase,
    now: () => paidAt,
  });
  return { service, stored, entries, charges, markPaidCalls, attachCalls };
}

describe("StoreService", () => {
  describe("quote", () => {
    it("multiplies the quantity by the configured price per chip", () => {
      const { service } = buildService();

      assert.deepStrictEqual(service.quote({ quantity: 5_000 }), { quantity: 5_000, amountCents: 500_000 });
    });

    it("refuses a quantity above the configured maximum", () => {
      const { service } = buildService({ maxChipsPerPurchase: 10_000 });

      assert.throws(() => service.quote({ quantity: 11_000 }), {
        statusCode: 422,
        message: errors.store.quantityAboveMaximum.replace("{{maximum}}", "10000"),
      });
    });

    it("accepts exactly the maximum", () => {
      const { service } = buildService({ maxChipsPerPurchase: 10_000 });

      assert.strictEqual(service.quote({ quantity: 10_000 }).amountCents, 1_000_000);
    });
  });

  describe("buy", () => {
    it("creates the purchase, charges the provider and credits the chips once the provider approves", async () => {
      const { service, charges, entries, attachCalls, markPaidCalls } = buildService();

      const purchase = await service.buy({ userId, quantity: 2_000 });

      assert.deepStrictEqual(charges, [{ purchaseId: "p-1", userId, quantity: 2_000, amountCents: 200_000 }]);
      assert.deepStrictEqual(attachCalls, [{ purchaseId: "p-1", providerTransactionId: "tx-1" }]);
      assert.deepStrictEqual(markPaidCalls, [{ purchaseId: "p-1", paidAt }]);
      assert.deepStrictEqual(entries, [
        {
          fromAccount: HOUSE_ACCOUNT,
          toAccount: userAccount({ userId }),
          amount: 2_000,
          type: "PURCHASE",
          idempotencyKey: "purchase:p-1",
          purchaseId: "p-1",
        },
      ]);
      assert.strictEqual(purchase.status, "PAID");
      assert.strictEqual(purchase.paidAt, paidAt.toISOString());
      assert.strictEqual(purchase.amountCents, 200_000);
    });

    it("leaves the purchase pending and credits nothing while the provider has not approved", async () => {
      const { service, entries } = buildService({ chargeResult: { providerTransactionId: "pix-9", status: "PENDING" } });

      const purchase = await service.buy({ userId, quantity: 1_000 });

      assert.strictEqual(purchase.status, "PENDING");
      assert.strictEqual(purchase.paidAt, null);
      assert.deepStrictEqual(entries, []);
    });

    it("does not create anything when the quantity is above the maximum", async () => {
      const { service, stored, charges } = buildService({ maxChipsPerPurchase: 5_000 });

      await assert.rejects(service.buy({ userId, quantity: 6_000 }), { statusCode: 422 });
      assert.deepStrictEqual(stored, []);
      assert.deepStrictEqual(charges, []);
    });
  });

  describe("confirmPurchase", () => {
    const paid: PurchaseRecord = {
      id: "p-1",
      userId,
      quantity: 3_000,
      amountCents: 300_000,
      status: "PAID",
      providerTransactionId: "tx-1",
      createdAt: paidAt,
      paidAt,
    };

    it("does not credit again when the provider confirms the same transaction twice", async () => {
      const { service, entries, markPaidCalls } = buildService({ existing: paid });

      const purchase = await service.confirmPurchase({ providerTransactionId: "tx-1" });

      assert.strictEqual(purchase.status, "PAID");
      assert.deepStrictEqual(entries, []);
      assert.deepStrictEqual(markPaidCalls, []);
    });

    it("does not credit when another confirmation paid the purchase first", async () => {
      const pending: PurchaseRecord = { ...paid, status: "PENDING", paidAt: null };
      const { service, entries } = buildService({ existing: pending, markPaidResult: false });

      await service.confirmPurchase({ providerTransactionId: "tx-1" });

      assert.deepStrictEqual(entries, []);
    });

    it("answers 404 for a transaction the store does not know", async () => {
      const { service } = buildService();

      await assert.rejects(service.confirmPurchase({ providerTransactionId: "unknown" }), {
        statusCode: 404,
        message: errors.store.purchaseNotFound,
      });
    });
  });
});
