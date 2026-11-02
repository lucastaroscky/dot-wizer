import type { Prisma } from "../../../generated/prisma/client.ts";
import type { PaymentProviderName } from "../../../generated/prisma/enums.ts";
import type { DatabaseClient } from "../../../common/database/database-client.ts";

const purchaseSelect = {
  id: true,
  userId: true,
  quantity: true,
  amountCents: true,
  status: true,
  providerTransactionId: true,
  createdAt: true,
  paidAt: true,
} satisfies Prisma.PurchaseSelect;

export type PurchaseRecord = Prisma.PurchaseGetPayload<{ select: typeof purchaseSelect }>;

interface CreateOnceInput {
  userId: string;
  quantity: number;
  amountCents: number;
  provider: PaymentProviderName;
  idempotencyKey: string;
}

export interface CreateOnceResult {
  purchase: PurchaseRecord;
  created: boolean;
}

interface AttachProviderTransactionInput {
  purchaseId: string;
  providerTransactionId: string;
}

interface FindByProviderTransactionInput {
  provider: PaymentProviderName;
  providerTransactionId: string;
}

interface MarkPaidInput {
  purchaseId: string;
  paidAt: Date;
}

export class PurchasesRepository {
  private readonly client: DatabaseClient;

  constructor({ client }: { client: DatabaseClient }) {
    this.client = client;
  }

  async createOnce(input: CreateOnceInput): Promise<CreateOnceResult> {
    const { count } = await this.client.purchase.createMany({ data: [input], skipDuplicates: true });
    const purchase = await this.client.purchase.findUniqueOrThrow({
      where: { userId_idempotencyKey: { userId: input.userId, idempotencyKey: input.idempotencyKey } },
      select: purchaseSelect,
    });
    return { purchase, created: count === 1 };
  }

  async attachProviderTransaction({ purchaseId, providerTransactionId }: AttachProviderTransactionInput): Promise<void> {
    await this.client.purchase.update({ where: { id: purchaseId }, data: { providerTransactionId } });
  }

  getById({ purchaseId }: { purchaseId: string }): Promise<PurchaseRecord> {
    return this.client.purchase.findUniqueOrThrow({ where: { id: purchaseId }, select: purchaseSelect });
  }

  findByProviderTransaction({
    provider,
    providerTransactionId,
  }: FindByProviderTransactionInput): Promise<PurchaseRecord | null> {
    return this.client.purchase.findUnique({
      where: { provider_providerTransactionId: { provider, providerTransactionId } },
      select: purchaseSelect,
    });
  }

  async markPaid({ purchaseId, paidAt }: MarkPaidInput): Promise<boolean> {
    const { count } = await this.client.purchase.updateMany({
      where: { id: purchaseId, status: "PENDING" },
      data: { status: "PAID", paidAt },
    });
    return count === 1;
  }
}
