import type { MatchPlayerSummary } from "@pontinho/api-contract";
import { userAccount } from "../wallet/accounts.ts";
import type { MatchEntrySum } from "../wallet/repository/wallet.repository.ts";
import type { MatchPlayerRecord } from "./repository/matches.repository.ts";

interface SummarizePlayersInput {
  players: MatchPlayerRecord[];
  nicknames: Record<string, string | null>;
  sums: MatchEntrySum[];
}

interface TotalInput {
  sums: MatchEntrySum[];
  type: MatchEntrySum["type"];
  side: "fromAccount" | "toAccount";
  account: string;
}

function totalOf({ sums, type, side, account }: TotalInput): number {
  return sums
    .filter((sum) => sum.type === type && sum[side] === account)
    .reduce((total, sum) => total + sum.amount, 0);
}

export function summarizePlayers({ players, nicknames, sums }: SummarizePlayersInput): MatchPlayerSummary[] {
  return players.map((player) => {
    const account = userAccount({ userId: player.userId });
    return {
      userId: player.userId,
      nickname: nicknames[player.userId] ?? null,
      startBalance: player.startBalance,
      paid: totalOf({ sums, type: "ROUND_PAYMENT", side: "fromAccount", account }),
      received: totalOf({ sums, type: "ROUND_PAYMENT", side: "toAccount", account }),
      deficitCleared: totalOf({ sums, type: "DEFICIT_OFFSET", side: "fromAccount", account }),
      deficit: player.deficit,
      winBonus: player.winBonus,
      result: player.result,
      finalBalance: player.finalBalance,
    };
  });
}
