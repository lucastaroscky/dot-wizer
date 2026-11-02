import assert from "assert";
import { brasiliaDay, CHIP_TABLES, settleRound, winBonus, type MatchFinance } from "../src/index.js";

function finance(playerId: string, startBalance: number, result = 0, deficit = 0): MatchFinance {
  return { playerId, startBalance, result, deficit };
}

function financeOf(finances: MatchFinance[], playerId: string) {
  const found = finances.find((item) => item.playerId === playerId);
  assert.ok(found);
  return found;
}

describe("settleRound: pagamento da rodada", () => {
  it("each loser pays hand points times point value and the winner receives the sum (item 3, mesa 1)", () => {
    const settlement = settleRound({
      finances: [finance("ana", 1000), finance("bruno", 1000), finance("carla", 1000), finance("davi", 1000)],
      handPoints: { bruno: 10, carla: 25, davi: 82 },
      winnerId: "ana",
      pointValue: 1,
    });

    assert.deepStrictEqual(settlement.payments, [
      { from: "bruno", to: "ana", amount: 10 },
      { from: "carla", to: "ana", amount: 25 },
      { from: "davi", to: "ana", amount: 82 },
    ]);
    assert.strictEqual(financeOf(settlement.finances, "ana").result, 117);
    assert.strictEqual(financeOf(settlement.finances, "bruno").result, -10);
    assert.strictEqual(financeOf(settlement.finances, "carla").result, -25);
    assert.strictEqual(financeOf(settlement.finances, "davi").result, -82);
    assert.deepStrictEqual(settlement.deficitCleared, []);
  });

  it("multiplies hand points by the table point value (mesa 3: 25 points pay 250)", () => {
    const settlement = settleRound({
      finances: [finance("ana", 10000), finance("bruno", 10000)],
      handPoints: { bruno: 25 },
      winnerId: "ana",
      pointValue: 10,
    });

    assert.deepStrictEqual(settlement.payments, [{ from: "bruno", to: "ana", amount: 250 }]);
  });

  it("lets a player lose everything without deficit and keep playing (item 5)", () => {
    const afterLosing = settleRound({
      finances: [finance("ana", 5000), finance("bruno", 100)],
      handPoints: { bruno: 10 },
      winnerId: "ana",
      pointValue: 10,
    });
    const bruno = financeOf(afterLosing.finances, "bruno");

    assert.strictEqual(bruno.result, -100);
    assert.strictEqual(bruno.deficit, 0);

    const afterWinning = settleRound({
      finances: [financeOf(afterLosing.finances, "ana"), bruno, finance("carla", 5000)],
      handPoints: { ana: 6, carla: 5 },
      winnerId: "bruno",
      pointValue: 10,
    });
    const winner = financeOf(afterWinning.finances, "bruno");

    assert.strictEqual(winner.result, 10);
    assert.strictEqual(winner.startBalance + winner.result, 110);
  });

  it("makes a debtor pay only what is available and records the rest as deficit; the winner receives only what was paid", () => {
    const settlement = settleRound({
      finances: [finance("ana", 1000), finance("bruno", 50)],
      handPoints: { bruno: 80 },
      winnerId: "ana",
      pointValue: 1,
    });

    assert.deepStrictEqual(settlement.payments, [{ from: "bruno", to: "ana", amount: 50 }]);
    assert.deepStrictEqual(financeOf(settlement.finances, "bruno"), finance("bruno", 50, -50, 30));
    assert.strictEqual(financeOf(settlement.finances, "ana").result, 50);
  });

  it("clears the deficit first when the player receives later in the same match; the cleared value stays with the house", () => {
    const afterDeficit = settleRound({
      finances: [finance("ana", 1000), finance("bruno", 50), finance("carla", 1000)],
      handPoints: { bruno: 80 },
      winnerId: "ana",
      pointValue: 1,
    });
    const indebted = financeOf(afterDeficit.finances, "bruno");

    assert.deepStrictEqual(indebted, finance("bruno", 50, -50, 30));

    const afterReceiving = settleRound({
      finances: [financeOf(afterDeficit.finances, "ana"), indebted, financeOf(afterDeficit.finances, "carla")],
      handPoints: { ana: 60, carla: 50 },
      winnerId: "bruno",
      pointValue: 1,
    });
    const recovered = financeOf(afterReceiving.finances, "bruno");

    assert.deepStrictEqual(afterReceiving.payments, [
      { from: "ana", to: "bruno", amount: 60 },
      { from: "carla", to: "bruno", amount: 50 },
    ]);
    assert.deepStrictEqual(afterReceiving.deficitCleared, [{ playerId: "bruno", amount: 30 }]);
    assert.strictEqual(recovered.deficit, 0);
    assert.strictEqual(recovered.result - indebted.result, 80);
  });

  it("clears only part of the deficit when the player receives less than he owes", () => {
    const settlement = settleRound({
      finances: [finance("ana", 1000), finance("bruno", 50, -50, 30)],
      handPoints: { ana: 20 },
      winnerId: "bruno",
      pointValue: 1,
    });

    assert.deepStrictEqual(settlement.deficitCleared, [{ playerId: "bruno", amount: 20 }]);
    assert.deepStrictEqual(financeOf(settlement.finances, "bruno"), finance("bruno", 50, -50, 10));
  });

  it("never lets the available balance go negative and records no payment when nothing is available", () => {
    let finances = [finance("ana", 1000), finance("bruno", 100)];
    const paymentsPerRound: number[] = [];

    for (let round = 1; round <= 3; round++) {
      const settlement = settleRound({ finances, handPoints: { bruno: 80 }, winnerId: "ana", pointValue: 1 });
      finances = settlement.finances;
      const bruno = financeOf(finances, "bruno");
      paymentsPerRound.push(settlement.payments.length);

      assert.ok(bruno.startBalance + bruno.result >= 0);
    }

    assert.deepStrictEqual(paymentsPerRound, [1, 1, 0]);
    assert.deepStrictEqual(financeOf(finances, "bruno"), finance("bruno", 100, -100, 140));
    assert.strictEqual(financeOf(finances, "ana").result, 100);
  });
});

describe("winBonus", () => {
  it("is 10 times the point value of the table (mesa 3 gives 100)", () => {
    const table = CHIP_TABLES.find(({ id }) => id === 3);
    assert.ok(table);

    assert.strictEqual(winBonus(table.pointValue), 100);
  });
});

describe("brasiliaDay", () => {
  it("returns the previous day at 02:30 UTC because Brasilia is UTC-3", () => {
    assert.strictEqual(brasiliaDay(new Date("2026-11-02T02:30:00Z")), "2026-11-01");
  });

  it("changes day exactly at 03:00 UTC", () => {
    assert.strictEqual(brasiliaDay(new Date("2026-11-02T02:59:59Z")), "2026-11-01");
    assert.strictEqual(brasiliaDay(new Date("2026-11-02T03:00:00Z")), "2026-11-02");
  });

  it("crosses month and year boundaries", () => {
    assert.strictEqual(brasiliaDay(new Date("2027-01-01T01:00:00Z")), "2026-12-31");
  });
});
