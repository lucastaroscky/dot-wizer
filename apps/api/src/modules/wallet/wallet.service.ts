import { brasiliaDay, DAILY_BONUS } from "@pontinho/rules";
import type {
  DailyBonusResponse,
  WalletEntriesQuery,
  WalletEntriesResponse,
  WalletEntryResponse,
  WalletResponse,
} from "@pontinho/api-contract";
import { ApiError } from "../../common/errors/api-error.ts";
import { HOUSE_ACCOUNT, userAccount } from "./accounts.ts";
import type { WalletEntryRecord, WalletRepository } from "./repository/wallet.repository.ts";

interface WalletServiceInput {
  walletRepository: WalletRepository;
  now: () => Date;
}

interface UserInput {
  userId: string;
}

interface ListEntriesInput extends UserInput, Pick<WalletEntriesQuery, "limit" | "cursor"> {}

interface ToEntryResponseInput {
  entry: WalletEntryRecord;
  account: string;
}

function toEntryResponse({ entry, account }: ToEntryResponseInput): WalletEntryResponse {
  const paidByUser = entry.fromAccount === account;
  return {
    id: entry.id,
    type: entry.type,
    amount: paidByUser ? -entry.amount : entry.amount,
    matchId: entry.matchId,
    roundNumber: entry.roundNumber,
    createdAt: entry.createdAt.toISOString(),
  };
}

export class WalletService {
  private readonly walletRepository: WalletRepository;
  private readonly now: () => Date;

  constructor({ walletRepository, now }: WalletServiceInput) {
    this.walletRepository = walletRepository;
    this.now = now;
  }

  async getWallet({ userId }: UserInput): Promise<WalletResponse> {
    const alreadyClaimed = await this.walletRepository.existsByKey({
      idempotencyKey: this.dailyBonusKey({ userId }),
    });
    return { balance: await this.balanceOf({ userId }), dailyBonusAvailable: !alreadyClaimed };
  }

  async balanceOf({ userId }: UserInput): Promise<number> {
    const account = userAccount({ userId });
    const balances = await this.walletRepository.balancesOf({ accounts: [account] });
    return balances[account];
  }

  async claimDailyBonus({ userId }: UserInput): Promise<DailyBonusResponse> {
    const claimed = await this.walletRepository.createEntryOnce({
      entry: {
        fromAccount: HOUSE_ACCOUNT,
        toAccount: userAccount({ userId }),
        amount: DAILY_BONUS,
        type: "DAILY_BONUS",
        idempotencyKey: this.dailyBonusKey({ userId }),
      },
    });
    if (!claimed) {
      throw new ApiError({ code: "dailyBonusAlreadyClaimed" });
    }
    return { amount: DAILY_BONUS, balance: await this.balanceOf({ userId }) };
  }

  async listEntries({ userId, limit, cursor }: ListEntriesInput): Promise<WalletEntriesResponse> {
    const account = userAccount({ userId });
    const rows = await this.walletRepository.listEntries({ account, limit: limit + 1, cursor });
    const page = rows.slice(0, limit);
    const hasMore = rows.length > limit;
    return {
      entries: page.map((entry) => toEntryResponse({ entry, account })),
      nextCursor: hasMore ? page[page.length - 1].id : null,
    };
  }

  private dailyBonusKey({ userId }: UserInput): string {
    return `daily:${userId}:${brasiliaDay(this.now())}`;
  }
}
