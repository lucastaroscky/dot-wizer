import assert from "node:assert";
import { fake } from "../../../test/support/fake.ts";
import errors from "../../common/messages/errors.json" with { type: "json" };
import type { UsersRepository } from "../users/repository/users.repository.ts";
import { HOUSE_ACCOUNT, userAccount } from "./accounts.ts";
import { postEntries } from "./post-entries.ts";
import type { NewWalletEntry, WalletRepository } from "./repository/wallet.repository.ts";

const ana = "11111111-1111-4111-8111-111111111111";
const bia = "22222222-2222-4222-8222-222222222222";

function entry(overrides: Partial<NewWalletEntry>): NewWalletEntry {
  return {
    fromAccount: userAccount({ userId: ana }),
    toAccount: userAccount({ userId: bia }),
    amount: 10,
    type: "ROUND_PAYMENT",
    idempotencyKey: "key",
    ...overrides,
  };
}

function buildRepositories({ balances }: { balances: Record<string, number> }) {
  const calls: string[] = [];
  const locked: string[][] = [];
  const created: NewWalletEntry[][] = [];
  const users = fake<UsersRepository>({
    lockByIds: async ({ ids }) => {
      calls.push("lock");
      locked.push(ids);
    },
  });
  const wallet = fake<WalletRepository>({
    createEntries: async ({ entries }) => {
      calls.push("create");
      created.push(entries);
    },
    balancesOf: async () => {
      calls.push("balances");
      return balances;
    },
  });
  return { repositories: { users, wallet }, calls, locked, created };
}

describe("postEntries", () => {
  it("locks the debited users, writes the entries and then checks the balances", async () => {
    const { repositories, calls, locked, created } = buildRepositories({
      balances: { [userAccount({ userId: ana })]: 5 },
    });
    const entries = [entry({})];

    await postEntries({ repositories, entries });

    assert.deepStrictEqual(calls, ["lock", "create", "balances"]);
    assert.deepStrictEqual(locked, [[ana]]);
    assert.deepStrictEqual(created, [entries]);
  });

  it("locks each user once, in id order, even when debited by several entries", async () => {
    const { repositories, locked } = buildRepositories({
      balances: { [userAccount({ userId: ana })]: 0, [userAccount({ userId: bia })]: 0 },
    });
    const entries = [
      entry({ fromAccount: userAccount({ userId: bia }), toAccount: userAccount({ userId: ana }), idempotencyKey: "a" }),
      entry({ fromAccount: userAccount({ userId: ana }), toAccount: HOUSE_ACCOUNT, idempotencyKey: "b" }),
      entry({ fromAccount: userAccount({ userId: bia }), toAccount: HOUSE_ACCOUNT, idempotencyKey: "c" }),
    ];

    await postEntries({ repositories, entries });

    assert.deepStrictEqual(locked, [[ana, bia]]);
  });

  it("does not lock anyone when only the house is debited", async () => {
    const { repositories, locked, calls } = buildRepositories({ balances: {} });

    await postEntries({
      repositories,
      entries: [entry({ fromAccount: HOUSE_ACCOUNT, toAccount: userAccount({ userId: ana }), type: "DAILY_BONUS" })],
    });

    assert.deepStrictEqual(locked, [[]]);
    assert.deepStrictEqual(calls, ["lock", "create"]);
  });

  it("rejects when a debit would leave a user with negative balance", async () => {
    const { repositories } = buildRepositories({ balances: { [userAccount({ userId: ana })]: -1 } });

    await assert.rejects(postEntries({ repositories, entries: [entry({})] }), {
      statusCode: 409,
      message: errors.wallet.insufficientBalance,
    });
  });
});
