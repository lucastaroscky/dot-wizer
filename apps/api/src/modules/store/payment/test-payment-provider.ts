import type { ChargeInput, ChargeResult, PaymentProvider } from "./payment-provider.ts";

export class TestPaymentProvider implements PaymentProvider {
  readonly name = "TEST";

  async charge({ purchaseId }: ChargeInput): Promise<ChargeResult> {
    return { providerTransactionId: `test:${purchaseId}`, status: "PAID" };
  }
}
