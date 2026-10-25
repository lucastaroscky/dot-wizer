import assert from "assert";
import { canDiscard, createMeld, findGoOut, handPoints, type Card, type Rank, type Suit } from "../src/index.js";

let nextId = 0;
function card(rank: Rank, suit: Suit): Card {
  nextId++;
  return { id: `${rank}-${suit}-${nextId}`, rank, suit };
}
function joker(): Card {
  nextId++;
  return { id: `JOKER-${nextId}`, rank: "JOKER" };
}

describe("createMeld when going out", () => {
  it("lets a joker sit at the end of a sequência", () => {
    const meld = createMeld([card("4", "hearts"), card("5", "hearts"), joker()], { goingOut: true });
    assert.deepStrictEqual(meld?.cards.map((item) => item.rank), ["4", "5", "JOKER"]);
  });

  it("lets two jokers sit side by side", () => {
    const meld = createMeld([card("4", "hearts"), joker(), joker(), card("7", "hearts")], { goingOut: true });
    assert.deepStrictEqual(meld?.cards.map((item) => item.rank), ["4", "JOKER", "JOKER", "7"]);
  });
});

describe("findGoOut", () => {
  it("finds melds for every card but one, which is discarded", () => {
    const hand = [
      card("7", "clubs"), card("7", "diamonds"), card("7", "spades"),
      card("4", "hearts"), card("5", "hearts"), card("6", "hearts"),
      card("K", "spades"),
    ];

    const result = findGoOut(hand, []);

    assert.strictEqual(result?.discard?.rank, "K");
    assert.strictEqual(result?.table.length, 2);
  });

  it("can lay off cards on melds already on the table", () => {
    const table = [createMeld([card("4", "hearts"), card("5", "hearts"), card("6", "hearts")])!];
    const hand = [card("7", "hearts"), card("8", "hearts"), card("2", "clubs")];

    const result = findGoOut(hand, table);

    assert.strictEqual(result?.discard?.rank, "2");
    assert.deepStrictEqual(result?.table[0].cards.map((item) => item.rank), ["4", "5", "6", "7", "8"]);
  });

  it("goes out without discarding when every card fits on the table", () => {
    const table = [createMeld([card("4", "hearts"), card("5", "hearts"), card("6", "hearts")])!];

    const result = findGoOut([card("7", "hearts"), card("3", "hearts")], table);

    assert.strictEqual(result?.discard, undefined);
    assert.strictEqual(result?.table[0].cards.length, 5);
  });

  it("must use the card taken from the discard", () => {
    const taken = card("9", "clubs");
    const hand = [card("7", "clubs"), card("7", "diamonds"), card("7", "spades"), card("2", "hearts"), taken];

    assert.strictEqual(findGoOut(hand, [], taken), undefined);
  });

  it("never chooses the joker as the card to discard", () => {
    const hand = [card("7", "clubs"), card("7", "diamonds"), card("7", "spades"), joker()];

    assert.strictEqual(findGoOut(hand, []), undefined);
  });

  it("returns nothing when the hand cannot go out", () => {
    const hand = [card("2", "clubs"), card("9", "diamonds"), card("K", "spades"), card("5", "hearts")];

    assert.strictEqual(findGoOut(hand, []), undefined);
  });
});

describe("handPoints", () => {
  it("counts joker 20, ace 15, faces 10 and numbers by value", () => {
    assert.strictEqual(handPoints([joker(), card("A", "clubs"), card("K", "clubs"), card("7", "hearts")]), 52);
  });
});

describe("canDiscard", () => {
  const table = [createMeld([card("4", "hearts"), card("5", "hearts"), card("6", "hearts")])!];

  it("refuses the joker", () => {
    const wild = joker();
    assert.strictEqual(canDiscard(wild, table), false);
  });

  it("refuses a card that fits a meld on the table", () => {
    assert.strictEqual(canDiscard(card("7", "hearts"), table), false);
  });

  it("accepts a card that fits nowhere", () => {
    assert.strictEqual(canDiscard(card("K", "spades"), table), true);
  });

  it("refuses a card that can take the place of a joker on the table", () => {
    const withJoker = [createMeld([card("4", "clubs"), joker(), card("6", "clubs")])!];
    assert.strictEqual(canDiscard(card("5", "clubs"), withJoker), false);
  });
});
