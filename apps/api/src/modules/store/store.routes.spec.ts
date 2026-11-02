import assert from "node:assert";
import errors from "../../common/messages/errors.json" with { type: "json" };
import { createTestApp } from "../../../test/support/test-app.ts";
import type { TestApp } from "../../../test/support/test-app.ts";
import { testPrisma } from "../../../test/support/test-database.ts";
import { HOUSE_ACCOUNT, userAccount } from "../wallet/accounts.ts";

describe("store routes", () => {
  let testApp: TestApp;

  before(async () => {
    testApp = await createTestApp({ CHIP_PRICE_CENTS: "250", MAX_CHIPS_PER_PURCHASE: "10000" });
  });
  after(async () => testApp.app.close());
  beforeEach(async () => testApp.reset());

  function buy(headers: { authorization: string }, quantity: number) {
    return testApp.app.inject({ method: "POST", url: "/store/purchases", headers, payload: { quantity } });
  }

  async function balanceOf(headers: { authorization: string }) {
    return (await testApp.app.inject({ method: "GET", url: "/wallet", headers })).json().balance;
  }

  describe("quote", () => {
    it("prices the quantity with the configured price per chip, in cents", async () => {
      const { headers } = await testApp.signIn();

      const response = await testApp.app.inject({ method: "GET", url: "/store/quote?quantity=3000", headers });

      assert.strictEqual(response.statusCode, 200);
      assert.deepStrictEqual(response.json(), { quantity: 3000, amountCents: 750_000 });
    });

    it("rejects quantities below 1.000 or off the 1.000 step", async () => {
      const { headers } = await testApp.signIn();

      for (const quantity of ["0", "500", "1500", "abc"]) {
        const response = await testApp.app.inject({ method: "GET", url: `/store/quote?quantity=${quantity}`, headers });
        assert.strictEqual(response.statusCode, 400, `quantity ${quantity}`);
      }
    });

    it("rejects a quantity above the configured maximum", async () => {
      const { headers } = await testApp.signIn();

      const response = await testApp.app.inject({ method: "GET", url: "/store/quote?quantity=11000", headers });

      assert.strictEqual(response.statusCode, 422);
      assert.strictEqual(response.json().message, errors.store.quantityAboveMaximum.replace("{{maximum}}", "10000"));
    });

    it("answers 401 without a token", async () => {
      const response = await testApp.app.inject({ method: "GET", url: "/store/quote?quantity=1000" });

      assert.strictEqual(response.statusCode, 401);
    });
  });

  describe("purchase", () => {
    it("approves right away with the test provider, charges nothing and credits the chips", async () => {
      const { userId, headers } = await testApp.signIn();

      const response = await buy(headers, 2000);

      const purchase = response.json();
      assert.strictEqual(response.statusCode, 201);
      assert.strictEqual(purchase.status, "PAID");
      assert.strictEqual(purchase.quantity, 2000);
      assert.strictEqual(purchase.amountCents, 500_000);
      assert.ok(purchase.paidAt);
      assert.strictEqual(await balanceOf(headers), 2000);
      const entry = await testPrisma.walletEntry.findUniqueOrThrow({ where: { idempotencyKey: `purchase:${purchase.id}` } });
      assert.strictEqual(entry.fromAccount, HOUSE_ACCOUNT);
      assert.strictEqual(entry.toAccount, userAccount({ userId }));
      assert.strictEqual(entry.type, "PURCHASE");
    });

    it("shows the purchase in the statement", async () => {
      const { headers } = await testApp.signIn();
      await buy(headers, 1000);

      const { entries } = (await testApp.app.inject({ method: "GET", url: "/wallet/entries", headers })).json();

      assert.deepStrictEqual(entries.map(({ type, amount }: { type: string; amount: number }) => [type, amount]), [["PURCHASE", 1000]]);
    });

    it("credits only once when the provider confirms the same transaction again", async () => {
      const { headers } = await testApp.signIn();
      const purchase = (await buy(headers, 3000)).json();
      const providerTransactionId = `test:${purchase.id}`;

      const again = await testApp.services.store.confirmPurchase({ providerTransactionId });
      const concurrent = await Promise.all([
        testApp.services.store.confirmPurchase({ providerTransactionId }),
        testApp.services.store.confirmPurchase({ providerTransactionId }),
      ]);

      assert.strictEqual(again.status, "PAID");
      assert.deepStrictEqual(concurrent.map(({ status }) => status), ["PAID", "PAID"]);
      assert.strictEqual(await balanceOf(headers), 3000);
      assert.strictEqual(await testPrisma.walletEntry.count({ where: { type: "PURCHASE" } }), 1);
    });

    it("credits once even when two confirmations of a pending purchase race", async () => {
      const { userId, headers } = await testApp.signIn();
      await balanceOf(headers);
      const pending = await testPrisma.purchase.create({
        data: { userId, quantity: 1000, amountCents: 250_000, provider: "TEST", providerTransactionId: "tx-race" },
      });

      const results = await Promise.all([
        testApp.services.store.confirmPurchase({ providerTransactionId: "tx-race" }),
        testApp.services.store.confirmPurchase({ providerTransactionId: "tx-race" }),
      ]);

      assert.deepStrictEqual(results.map(({ status }) => status), ["PAID", "PAID"]);
      assert.strictEqual(results[0].id, pending.id);
      assert.strictEqual(await balanceOf(headers), 1000);
    });

    it("rejects an unknown transaction", async () => {
      await assert.rejects(testApp.services.store.confirmPurchase({ providerTransactionId: "nope" }), {
        statusCode: 404,
      });
    });

    it("rejects a quantity above the maximum and records no purchase", async () => {
      const { headers } = await testApp.signIn();

      const response = await buy(headers, 11_000);

      assert.strictEqual(response.statusCode, 422);
      assert.strictEqual(await testPrisma.purchase.count(), 0);
    });

    it("rejects an invalid quantity and unknown fields", async () => {
      const { headers } = await testApp.signIn();

      const offStep = await buy(headers, 1500);
      const extra = await testApp.app.inject({
        method: "POST",
        url: "/store/purchases",
        headers,
        payload: { quantity: 1000, status: "PAID" },
      });

      assert.deepStrictEqual([offStep.statusCode, extra.statusCode], [400, 400]);
      assert.strictEqual(await testPrisma.purchase.count(), 0);
    });

    it("never trusts a chip amount sent by the client", async () => {
      const { headers } = await testApp.signIn();

      const response = await testApp.app.inject({
        method: "POST",
        url: "/store/purchases",
        headers,
        payload: { quantity: 1000, amount: 999_999 },
      });

      assert.strictEqual(response.statusCode, 400);
      assert.strictEqual(await balanceOf(headers), 0);
    });

    it("never exposes the provider transaction id or the user id", async () => {
      const { headers } = await testApp.signIn();

      const purchase = (await buy(headers, 1000)).json();

      assert.deepStrictEqual(Object.keys(purchase).sort(), ["amountCents", "createdAt", "id", "paidAt", "quantity", "status"]);
    });
  });
});
