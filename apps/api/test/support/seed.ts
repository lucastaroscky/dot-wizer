import { randomUUID } from "node:crypto";
import { HOUSE_ACCOUNT, userAccount } from "../../src/modules/wallet/accounts.ts";
import { testPrisma } from "./test-database.ts";

interface SeedUserInput {
  userId?: string;
  balance?: number;
  name?: string | null;
}

export async function seedUser({ userId = randomUUID(), balance = 0, name = null }: SeedUserInput = {}) {
  await testPrisma.user.create({ data: { id: userId, email: `${userId}@example.com`, name } });
  if (balance > 0) {
    await testPrisma.walletEntry.create({
      data: {
        fromAccount: HOUSE_ACCOUNT,
        toAccount: userAccount({ userId }),
        amount: balance,
        type: "PURCHASE",
        idempotencyKey: `seed:${userId}`,
      },
    });
  }
  return userId;
}

export async function ledgerBalance({ account }: { account: string }): Promise<number> {
  const credits = await testPrisma.walletEntry.aggregate({ where: { toAccount: account }, _sum: { amount: true } });
  const debits = await testPrisma.walletEntry.aggregate({ where: { fromAccount: account }, _sum: { amount: true } });
  return (credits._sum.amount ?? 0) - (debits._sum.amount ?? 0);
}

export async function allBalances(): Promise<Record<string, number>> {
  const rows = await testPrisma.walletEntry.findMany({ select: { fromAccount: true, toAccount: true, amount: true } });
  const balances: Record<string, number> = {};
  for (const { fromAccount, toAccount, amount } of rows) {
    balances[fromAccount] = (balances[fromAccount] ?? 0) - amount;
    balances[toAccount] = (balances[toAccount] ?? 0) + amount;
  }
  return balances;
}
