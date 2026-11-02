import assert from "node:assert";
import { HOUSE_ACCOUNT, userAccount } from "../wallet/accounts.ts";
import { roundEntries } from "./round-entries.ts";

const matchId = "33333333-3333-4333-8333-333333333333";
const ana = "11111111-1111-4111-8111-111111111111";
const bia = "22222222-2222-4222-8222-222222222222";
const caio = "44444444-4444-4444-8444-444444444444";

describe("roundEntries", () => {
  it("turns each payment into a transfer from the loser to the winner at the full amount", () => {
    const entries = roundEntries({
      matchId,
      roundNumber: 3,
      settlement: {
        finances: [],
        payments: [
          { from: bia, to: ana, amount: 50 },
          { from: caio, to: ana, amount: 100 },
        ],
        deficitCleared: [],
      },
    });

    assert.deepStrictEqual(entries, [
      {
        fromAccount: userAccount({ userId: bia }),
        toAccount: userAccount({ userId: ana }),
        amount: 50,
        type: "ROUND_PAYMENT",
        idempotencyKey: `match:${matchId}:round:3:payment:${bia}`,
        matchId,
        roundNumber: 3,
      },
      {
        fromAccount: userAccount({ userId: caio }),
        toAccount: userAccount({ userId: ana }),
        amount: 100,
        type: "ROUND_PAYMENT",
        idempotencyKey: `match:${matchId}:round:3:payment:${caio}`,
        matchId,
        roundNumber: 3,
      },
    ]);
  });

  it("sends the cleared deficit from the winner to the house as a separate entry", () => {
    const entries = roundEntries({
      matchId,
      roundNumber: 2,
      settlement: {
        finances: [],
        payments: [{ from: bia, to: ana, amount: 80 }],
        deficitCleared: [{ playerId: ana, amount: 30 }],
      },
    });

    assert.strictEqual(entries.length, 2);
    assert.deepStrictEqual(entries[1], {
      fromAccount: userAccount({ userId: ana }),
      toAccount: HOUSE_ACCOUNT,
      amount: 30,
      type: "DEFICIT_OFFSET",
      idempotencyKey: `match:${matchId}:round:2:offset:${ana}`,
      matchId,
      roundNumber: 2,
    });
  });

  it("writes nothing when nobody could pay", () => {
    const entries = roundEntries({
      matchId,
      roundNumber: 1,
      settlement: { finances: [], payments: [], deficitCleared: [] },
    });

    assert.deepStrictEqual(entries, []);
  });
});
