export type ChipTable = { id: number; minimumBalance: number; pointValue: number };

export const CHIP_TABLES: ChipTable[] = [
  { id: 1, minimumBalance: 1_000, pointValue: 1 },
  { id: 2, minimumBalance: 5_000, pointValue: 5 },
  { id: 3, minimumBalance: 10_000, pointValue: 10 },
  { id: 4, minimumBalance: 20_000, pointValue: 20 },
  { id: 5, minimumBalance: 50_000, pointValue: 50 },
  { id: 6, minimumBalance: 100_000, pointValue: 100 },
  { id: 7, minimumBalance: 200_000, pointValue: 200 },
];

export const WIN_BONUS_POINTS = 10;
export const DAILY_BONUS = 100;

export function winBonus(pointValue: number) {
  return WIN_BONUS_POINTS * pointValue;
}

const brasiliaDateFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Sao_Paulo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function brasiliaDay(date: Date) {
  const parts = Object.fromEntries(brasiliaDateFormat.formatToParts(date).map(({ type, value }) => [type, value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export type MatchFinance = { playerId: string; startBalance: number; result: number; deficit: number };
export type Payment = { from: string; to: string; amount: number };
export type DeficitCleared = { playerId: string; amount: number };

export type RoundSettlementInput = {
  finances: MatchFinance[];
  handPoints: Record<string, number>;
  winnerId: string;
  pointValue: number;
};

export type RoundSettlement = {
  finances: MatchFinance[];
  payments: Payment[];
  deficitCleared: DeficitCleared[];
};

function availableBalance({ startBalance, result }: MatchFinance) {
  return Math.max(0, startBalance + result);
}

function payDebt(finance: MatchFinance, owed: number) {
  const paid = Math.min(owed, availableBalance(finance));
  return {
    finance: { ...finance, result: finance.result - paid, deficit: finance.deficit + owed - paid },
    paid,
  };
}

function receive(finance: MatchFinance, received: number) {
  const cleared = Math.min(finance.deficit, received);
  return {
    finance: { ...finance, result: finance.result + received - cleared, deficit: finance.deficit - cleared },
    cleared,
  };
}

export function settleRound({ finances, handPoints, winnerId, pointValue }: RoundSettlementInput): RoundSettlement {
  const debts = finances.map((finance) => {
    if (finance.playerId === winnerId) {
      return payDebt(finance, 0);
    }
    return payDebt(finance, (handPoints[finance.playerId] ?? 0) * pointValue);
  });
  const received = debts.reduce((total, { paid }) => total + paid, 0);
  const settled = debts.map(({ finance }) => {
    if (finance.playerId !== winnerId) {
      return { finance, cleared: 0 };
    }
    return receive(finance, received);
  });

  return {
    finances: settled.map(({ finance }) => finance),
    payments: debts
      .filter(({ paid }) => paid > 0)
      .map(({ finance, paid }) => ({ from: finance.playerId, to: winnerId, amount: paid })),
    deficitCleared: settled
      .filter(({ cleared }) => cleared > 0)
      .map(({ finance, cleared }) => ({ playerId: finance.playerId, amount: cleared })),
  };
}
