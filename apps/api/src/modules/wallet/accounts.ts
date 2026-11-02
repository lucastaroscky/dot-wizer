export const HOUSE_ACCOUNT = "house";

const USER_ACCOUNT_PREFIX = "user:";

interface UserAccountInput {
  userId: string;
}

export function userAccount({ userId }: UserAccountInput): string {
  return `${USER_ACCOUNT_PREFIX}${userId}`;
}

export function userIdOfAccount({ account }: { account: string }): string | null {
  if (!account.startsWith(USER_ACCOUNT_PREFIX)) {
    return null;
  }
  return account.slice(USER_ACCOUNT_PREFIX.length);
}
