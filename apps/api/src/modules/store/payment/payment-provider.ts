import type { PaymentProviderName, PurchaseStatus } from "../../../generated/prisma/enums.ts";

export interface ChargeInput {
  purchaseId: string;
  userId: string;
  quantity: number;
  amountCents: number;
}

export interface ChargeResult {
  providerTransactionId: string;
  status: PurchaseStatus;
}

export interface PaymentProvider {
  readonly name: PaymentProviderName;
  charge(input: ChargeInput): Promise<ChargeResult>;
}
