import { ConflictError } from "../../common/errors/http-errors.ts";
import errors from "../../common/messages/errors.json" with { type: "json" };
import type { UsersRepository } from "../users/repository/users.repository.ts";
import { userAccount, userIdOfAccount } from "./accounts.ts";
import type { NewWalletEntry, WalletRepository } from "./repository/wallet.repository.ts";

interface PostEntriesInput {
  repositories: { users: UsersRepository; wallet: WalletRepository };
  entries: NewWalletEntry[];
}

function debitedUserIds({ entries }: { entries: NewWalletEntry[] }): string[] {
  const userIds = entries.map(({ fromAccount }) => userIdOfAccount({ account: fromAccount }));
  return [...new Set(userIds.filter((userId): userId is string => userId !== null))].sort();
}

export async function postEntries({ repositories, entries }: PostEntriesInput): Promise<void> {
  const userIds = debitedUserIds({ entries });
  await repositories.users.lockByIds({ ids: userIds });
  await repositories.wallet.createEntries({ entries });
  if (userIds.length === 0) {
    return;
  }
  const accounts = userIds.map((userId) => userAccount({ userId }));
  const balances = await repositories.wallet.balancesOf({ accounts });
  if (accounts.some((account) => balances[account] < 0)) {
    throw new ConflictError(errors.wallet.insufficientBalance);
  }
}
