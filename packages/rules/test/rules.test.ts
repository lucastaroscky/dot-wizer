import assert from "assert";
import { createDeck, dealRound, drawFromStock, HAND_SIZE } from "../src/index.js";

describe("createDeck", () => {
  it("has two decks and four jokers, each card with its own id", () => {
    const deck = createDeck();

    assert.strictEqual(deck.length, 108);
    assert.strictEqual(deck.filter((card) => card.rank === "JOKER").length, 4);
    assert.strictEqual(new Set(deck.map((card) => card.id)).size, 108);
  });
});

describe("dealRound", () => {
  it("gives 9 cards to each player and turns one card to the discard", () => {
    const round = dealRound(3);

    assert.deepStrictEqual(round.hands.map((hand) => hand.length), [HAND_SIZE, HAND_SIZE, HAND_SIZE]);
    assert.strictEqual(round.discard.length, 1);
    assert.strictEqual(round.stock.length, 108 - 3 * HAND_SIZE - 1);
  });
});

describe("drawFromStock", () => {
  it("takes the top card of the stock", () => {
    const [first, second, third] = createDeck();

    const result = drawFromStock({ stock: [first, second], discard: [third] });

    assert.ok(result);
    assert.strictEqual(result.card, first);
    assert.deepStrictEqual(result.stock, [second]);
    assert.deepStrictEqual(result.discard, [third]);
  });

  it("returns nothing when the stock is empty and the discard has only its top card", () => {
    const [only] = createDeck();

    assert.strictEqual(drawFromStock({ stock: [], discard: [only] }), undefined);
  });

  it("reshuffles the discard into the stock when it runs out, keeping the last discarded card", () => {
    const [first, second, third] = createDeck();

    const result = drawFromStock({ stock: [], discard: [first, second, third] });

    assert.ok(result);
    assert.deepStrictEqual(result.discard, [third]);
    assert.deepStrictEqual([result.card, ...result.stock].map((card) => card.id).sort(), [first.id, second.id].sort());
  });
});
