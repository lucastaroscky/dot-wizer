import type { RoundSettlement } from "@pontinho/rules";
import { HOUSE_ACCOUNT, userAccount } from "../wallet/accounts.ts";
import type { NewWalletEntry } from "../wallet/repository/wallet.repository.ts";

interface RoundEntriesInput {
  matchId: string;
  roundNumber: number;
  settlement: RoundSettlement;
}

interface PaymentEntriesInput {
  matchId: string;
  roundNumber: number;
  payments: RoundSettlement["payments"];
}

interface OffsetEntriesInput {
  matchId: string;
  roundNumber: number;
  deficitCleared: RoundSettlement["deficitCleared"];
}

function paymentEntries({ matchId, roundNumber, payments }: PaymentEntriesInput): NewWalletEntry[] {
  return payments.map(({ from, to, amount }) => ({
    fromAccount: userAccount({ userId: from }),
    toAccount: userAccount({ userId: to }),
    amount,
    type: "ROUND_PAYMENT",
    idempotencyKey: `match:${matchId}:round:${roundNumber}:payment:${from}`,
    matchId,
    roundNumber,
  }));
}

function offsetEntries({ matchId, roundNumber, deficitCleared }: OffsetEntriesInput): NewWalletEntry[] {
  return deficitCleared.map(({ playerId, amount }) => ({
    fromAccount: userAccount({ userId: playerId }),
    toAccount: HOUSE_ACCOUNT,
    amount,
    type: "DEFICIT_OFFSET",
    idempotencyKey: `match:${matchId}:round:${roundNumber}:offset:${playerId}`,
    matchId,
    roundNumber,
  }));
}

export function roundEntries({ matchId, roundNumber, settlement }: RoundEntriesInput): NewWalletEntry[] {
  return [
    ...paymentEntries({ matchId, roundNumber, payments: settlement.payments }),
    ...offsetEntries({ matchId, roundNumber, deficitCleared: settlement.deficitCleared }),
  ];
}
