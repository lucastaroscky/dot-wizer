import assert from "node:assert";
import { TestPaymentProvider } from "./test-payment-provider.ts";

describe("TestPaymentProvider", () => {
  it("approves right away, without charging, with a transaction id derived from the purchase", async () => {
    const provider = new TestPaymentProvider();

    const result = await provider.charge({ purchaseId: "p-1", userId: "u-1", quantity: 1_000, amountCents: 100_000 });

    assert.deepStrictEqual(result, { providerTransactionId: "test:p-1", status: "PAID" });
    assert.strictEqual(provider.name, "TEST");
  });
});
