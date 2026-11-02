import { CHIP_PURCHASE_MINIMUM, CHIP_PURCHASE_STEP } from "@pontinho/api-contract";
import type { PurchaseResponse, QuoteResponse } from "@pontinho/api-contract";
import type { UnitOfWork } from "../../common/database/database-client.ts";
import { ConflictError, NotFoundError, UnprocessableError } from "../../common/errors/http-errors.ts";
import errors from "../../common/messages/errors.json" with { type: "json" };
import type { UsersRepository } from "../users/repository/users.repository.ts";
import { HOUSE_ACCOUNT, userAccount } from "../wallet/accounts.ts";
import { postEntries } from "../wallet/post-entries.ts";
import type { NewWalletEntry, WalletRepository } from "../wallet/repository/wallet.repository.ts";
import type { PaymentProvider } from "./payment/payment-provider.ts";
import type { PurchaseRecord, PurchasesRepository } from "./repository/purchases.repository.ts";

export interface StoreTransaction {
  purchases: PurchasesRepository;
  wallet: WalletRepository;
  users: UsersRepository;
}

interface StoreServiceInput {
  unitOfWork: UnitOfWork<StoreTransaction>;
  purchasesRepository: PurchasesRepository;
  paymentProvider: PaymentProvider;
  chipPriceCents: number;
  maxChipsPerPurchase: number;
  now: () => Date;
}

interface QuoteInput {
  quantity: number;
}

interface BuyInput extends QuoteInput {
  userId: string;
  idempotencyKey: string;
}

interface ReplayInput {
  purchase: PurchaseRecord;
  quantity: number;
}

interface ConfirmPurchaseInput {
  providerTransactionId: string;
}

interface CreditPurchaseInput {
  transaction: StoreTransaction;
  purchase: PurchaseRecord;
}

function toResponse({ purchase }: { purchase: PurchaseRecord }): PurchaseResponse {
  return {
    id: purchase.id,
    quantity: purchase.quantity,
    amountCents: purchase.amountCents,
    status: purchase.status,
    createdAt: purchase.createdAt.toISOString(),
    paidAt: purchase.paidAt?.toISOString() ?? null,
  };
}

function purchaseCreditEntry({ purchase }: { purchase: PurchaseRecord }): NewWalletEntry {
  return {
    fromAccount: HOUSE_ACCOUNT,
    toAccount: userAccount({ userId: purchase.userId }),
    amount: purchase.quantity,
    type: "PURCHASE",
    idempotencyKey: `purchase:${purchase.id}`,
    purchaseId: purchase.id,
  };
}

export class StoreService {
  private readonly unitOfWork: UnitOfWork<StoreTransaction>;
  private readonly purchasesRepository: PurchasesRepository;
  private readonly paymentProvider: PaymentProvider;
  private readonly chipPriceCents: number;
  private readonly maxChipsPerPurchase: number;
  private readonly now: () => Date;

  constructor(input: StoreServiceInput) {
    this.unitOfWork = input.unitOfWork;
    this.purchasesRepository = input.purchasesRepository;
    this.paymentProvider = input.paymentProvider;
    this.chipPriceCents = input.chipPriceCents;
    this.maxChipsPerPurchase = input.maxChipsPerPurchase;
    this.now = input.now;
  }

  quote({ quantity }: QuoteInput): QuoteResponse {
    if (quantity > this.maxChipsPerPurchase) {
      throw new UnprocessableError(
        errors.store.quantityAboveMaximum.replace("{{maximum}}", String(this.maxChipsPerPurchase)),
      );
    }
    return {
      quantity,
      amountCents: quantity * this.chipPriceCents,
      minimumQuantity: CHIP_PURCHASE_MINIMUM,
      quantityStep: CHIP_PURCHASE_STEP,
      maximumQuantity: this.maxChipsPerPurchase,
    };
  }

  async buy({ userId, quantity, idempotencyKey }: BuyInput): Promise<PurchaseResponse> {
    const { amountCents } = this.quote({ quantity });
    const provider = this.paymentProvider.name;
    const created = await this.purchasesRepository.createOnce({ userId, quantity, amountCents, provider, idempotencyKey });
    if (!created.created) {
      return this.replay({ purchase: created.purchase, quantity });
    }
    const { purchase } = created;
    const charge = await this.paymentProvider.charge({ purchaseId: purchase.id, userId, quantity, amountCents });
    const { providerTransactionId, status } = charge;
    await this.purchasesRepository.attachProviderTransaction({ purchaseId: purchase.id, providerTransactionId });
    if (status === "PAID") {
      return this.confirmPurchase({ providerTransactionId });
    }
    return toResponse({ purchase: { ...purchase, providerTransactionId } });
  }

  confirmPurchase({ providerTransactionId }: ConfirmPurchaseInput): Promise<PurchaseResponse> {
    return this.unitOfWork.run(async (transaction) => {
      const purchase = await transaction.purchases.findByProviderTransaction({
        provider: this.paymentProvider.name,
        providerTransactionId,
      });
      if (!purchase) {
        throw new NotFoundError(errors.store.purchaseNotFound);
      }
      if (purchase.status === "PAID") {
        return toResponse({ purchase });
      }
      return toResponse({ purchase: await this.creditPurchase({ transaction, purchase }) });
    });
  }

  private replay({ purchase, quantity }: ReplayInput): PurchaseResponse {
    if (purchase.quantity !== quantity) {
      throw new ConflictError(errors.store.idempotencyKeyReused);
    }
    return toResponse({ purchase });
  }

  private async creditPurchase({ transaction, purchase }: CreditPurchaseInput): Promise<PurchaseRecord> {
    const paidAt = this.now();
    const marked = await transaction.purchases.markPaid({ purchaseId: purchase.id, paidAt });
    if (!marked) {
      return transaction.purchases.getById({ purchaseId: purchase.id });
    }
    await postEntries({ repositories: transaction, entries: [purchaseCreditEntry({ purchase })] });
    return { ...purchase, status: "PAID", paidAt };
  }
}
