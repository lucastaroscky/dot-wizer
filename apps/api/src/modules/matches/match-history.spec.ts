import assert from "node:assert";
import { HOUSE_ACCOUNT, userAccount } from "../wallet/accounts.ts";
import type { MatchEntrySum } from "../wallet/repository/wallet.repository.ts";
import { summarizePlayers } from "./match-history.ts";
import type { MatchPlayerRecord } from "./repository/matches.repository.ts";

const ana = "11111111-1111-4111-8111-111111111111";
const bia = "22222222-2222-4222-8222-222222222222";

const players: MatchPlayerRecord[] = [
  { userId: ana, startBalance: 1000, result: 70, deficit: 0, winBonus: 50, finalBalance: 1120, eliminatedAt: null },
  { userId: bia, startBalance: 100, result: -100, deficit: 30, winBonus: 0, finalBalance: 0, eliminatedAt: null },
];

describe("summarizePlayers", () => {
  it("adds paid, received and cleared deficit from the entries of the match", () => {
    const sums: MatchEntrySum[] = [
      { type: "ROUND_PAYMENT", fromAccount: userAccount({ userId: bia }), toAccount: userAccount({ userId: ana }), amount: 100 },
      { type: "ROUND_PAYMENT", fromAccount: userAccount({ userId: ana }), toAccount: userAccount({ userId: bia }), amount: 0 },
      { type: "DEFICIT_OFFSET", fromAccount: userAccount({ userId: ana }), toAccount: HOUSE_ACCOUNT, amount: 30 },
      { type: "WIN_BONUS", fromAccount: HOUSE_ACCOUNT, toAccount: userAccount({ userId: ana }), amount: 50 },
    ];

    const summary = summarizePlayers({ players, names: { [ana]: "Ana", [bia]: "Bia" }, sums });

    assert.deepStrictEqual(summary, [
      { userId: ana, name: "Ana", startBalance: 1000, paid: 0, received: 100, deficitCleared: 30, deficit: 0, winBonus: 50, result: 70, finalBalance: 1120 },
      { userId: bia, name: "Bia", startBalance: 100, paid: 100, received: 0, deficitCleared: 0, deficit: 30, winBonus: 0, result: -100, finalBalance: 0 },
    ]);
  });

  it("keeps the final balance empty while the match is running and the name empty for a user without name", () => {
    const [running] = [{ ...players[0], finalBalance: null }];

    const [summary] = summarizePlayers({ players: [running], names: {}, sums: [] });

    assert.strictEqual(summary.finalBalance, null);
    assert.strictEqual(summary.name, null);
    assert.strictEqual(summary.paid, 0);
  });

  it("sums several payments of the same player across rounds", () => {
    const sums: MatchEntrySum[] = [
      { type: "ROUND_PAYMENT", fromAccount: userAccount({ userId: bia }), toAccount: userAccount({ userId: ana }), amount: 40 },
      { type: "ROUND_PAYMENT", fromAccount: userAccount({ userId: bia }), toAccount: userAccount({ userId: "other" }), amount: 25 },
    ];

    const summary = summarizePlayers({ players, names: {}, sums });

    assert.strictEqual(summary[1].paid, 65);
  });
});
