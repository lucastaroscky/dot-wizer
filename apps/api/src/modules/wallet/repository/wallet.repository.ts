import type { WalletEntryType } from "../../../generated/prisma/enums.ts";
import type { DatabaseClient } from "../../../common/database/database-client.ts";

export interface NewWalletEntry {
  fromAccount: string;
  toAccount: string;
  amount: number;
  type: WalletEntryType;
  idempotencyKey: string;
  matchId?: string;
  roundNumber?: number;
  purchaseId?: string;
}

export interface WalletEntryRecord {
  id: string;
  fromAccount: string;
  toAccount: string;
  amount: number;
  type: WalletEntryType;
  matchId: string | null;
  roundNumber: number | null;
  createdAt: Date;
}

export interface MatchEntrySum {
  type: WalletEntryType;
  fromAccount: string;
  toAccount: string;
  amount: number;
}

interface CreateEntriesInput {
  entries: NewWalletEntry[];
}

interface CreateEntryOnceInput {
  entry: NewWalletEntry;
}

interface BalancesOfInput {
  accounts: string[];
}

interface ListEntriesInput {
  account: string;
  limit: number;
  cursor?: string;
}

interface SumsByMatchInput {
  matchId: string;
}

export class WalletRepository {
  private readonly client: DatabaseClient;

  constructor({ client }: { client: DatabaseClient }) {
    this.client = client;
  }

  async createEntries({ entries }: CreateEntriesInput): Promise<void> {
    await this.client.walletEntry.createMany({ data: entries });
  }

  async createEntryOnce({ entry }: CreateEntryOnceInput): Promise<boolean> {
    const { count } = await this.client.walletEntry.createMany({ data: [entry], skipDuplicates: true });
    return count === 1;
  }

  async existsByKey({ idempotencyKey }: { idempotencyKey: string }): Promise<boolean> {
    const entry = await this.client.walletEntry.findUnique({ where: { idempotencyKey }, select: { id: true } });
    return entry !== null;
  }

  async balancesOf({ accounts }: BalancesOfInput): Promise<Record<string, number>> {
    const credits = await this.client.walletEntry.groupBy({
      by: ["toAccount"],
      where: { toAccount: { in: accounts } },
      _sum: { amount: true },
    });
    const debits = await this.client.walletEntry.groupBy({
      by: ["fromAccount"],
      where: { fromAccount: { in: accounts } },
      _sum: { amount: true },
    });
    const balances = Object.fromEntries(accounts.map((account) => [account, 0]));
    for (const { toAccount, _sum } of credits) {
      balances[toAccount] += _sum.amount ?? 0;
    }
    for (const { fromAccount, _sum } of debits) {
      balances[fromAccount] -= _sum.amount ?? 0;
    }
    return balances;
  }

  listEntries({ account, limit, cursor }: ListEntriesInput): Promise<WalletEntryRecord[]> {
    return this.client.walletEntry.findMany({
      where: { OR: [{ fromAccount: account }, { toAccount: account }] },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit,
      cursor: cursor ? { id: cursor } : undefined,
      skip: cursor ? 1 : 0,
      select: {
        id: true,
        fromAccount: true,
        toAccount: true,
        amount: true,
        type: true,
        matchId: true,
        roundNumber: true,
        createdAt: true,
      },
    });
  }

  async sumsByMatch({ matchId }: SumsByMatchInput): Promise<MatchEntrySum[]> {
    const rows = await this.client.walletEntry.groupBy({
      by: ["type", "fromAccount", "toAccount"],
      where: { matchId },
      _sum: { amount: true },
    });
    return rows.map(({ type, fromAccount, toAccount, _sum }) => ({
      type,
      fromAccount,
      toAccount,
      amount: _sum.amount ?? 0,
    }));
  }
}
