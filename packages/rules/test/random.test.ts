import assert from "assert";
import { applyAction, dealRound, drawFromStock, secureRandom, startMatch, startRound, cardById } from "../src/index.js";

describe("randomness of the deck", () => {
  function withoutMathRandom(run: () => void) {
    const original = Math.random;
    Math.random = () => {
      throw new Error("Math.random não pode embaralhar nem escolher cartas");
    };
    try {
      run();
    } finally {
      Math.random = original;
    }
  }

  it("shuffles, deals, reshuffles the discard and plays automatically without Math.random", () => {
    withoutMathRandom(() => {
      const round = dealRound(3);
      assert.strictEqual(new Set([...round.hands.flat(), ...round.stock, ...round.discard].map((card) => card.id)).size, 108);

      const reshuffled = drawFromStock({ stock: [], discard: [cardById("2-clubs-1"), cardById("3-clubs-1"), cardById("4-clubs-1")] });
      assert.strictEqual(reshuffled?.stock.length, 1);

      const game = startRound({ ...startMatch(["ana", "bruno", "carla"]), phase: "roundOver" });
      const played = applyAction(game, game.currentTurn, { type: "playAutomatically" });
      assert.ok("game" in played);
    });
  });

  it("draws floats from 0 up to but not including 1, with different values", () => {
    const draws = Array.from({ length: 1_000 }, () => secureRandom());

    assert.ok(draws.every((value) => value >= 0 && value < 1));
    assert.ok(new Set(draws).size > 990);
  });
});
