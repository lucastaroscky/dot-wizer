import assert from "assert";
import { addToMeld, createMeld, findMeldInHand, replaceJoker, type Card, type Rank, type Suit } from "../src/index.js";

let nextId = 0;
function card(rank: Rank, suit: Suit): Card {
  nextId++;
  return { id: `${rank}-${suit}-${nextId}`, rank, suit };
}
function joker(): Card {
  nextId++;
  return { id: `JOKER-${nextId}`, rank: "JOKER" };
}
function ranksOf(cards: Card[]) {
  return cards.map((item) => item.rank);
}

describe("createMeld: trinca", () => {
  it("accepts 3 or 4 cards of the same rank with different suits", () => {
    assert.strictEqual(createMeld([card("7", "clubs"), card("7", "diamonds"), card("7", "spades")])?.kind, "set");
    assert.strictEqual(createMeld([card("7", "clubs"), card("7", "diamonds"), card("7", "spades"), card("7", "hearts")])?.kind, "set");
  });

  it("rejects repeated suits when starting, jokers and fewer than 3 cards", () => {
    assert.strictEqual(createMeld([card("7", "clubs"), card("7", "clubs"), card("7", "spades")]), undefined);
    assert.strictEqual(createMeld([card("7", "clubs"), card("7", "diamonds"), joker()]), undefined);
    assert.strictEqual(createMeld([card("7", "clubs"), card("7", "diamonds")]), undefined);
  });
});

describe("createMeld: sequência", () => {
  it("accepts consecutive cards of the same suit in any order", () => {
    const meld = createMeld([card("6", "hearts"), card("4", "hearts"), card("5", "hearts")]);
    assert.strictEqual(meld?.kind, "run");
    assert.deepStrictEqual(ranksOf(meld.cards), ["4", "5", "6"]);
  });

  it("accepts the ace low (A-2-3) and high (Q-K-A), but not wrapping (K-A-2)", () => {
    assert.deepStrictEqual(ranksOf(createMeld([card("A", "spades"), card("2", "spades"), card("3", "spades")])!.cards), ["A", "2", "3"]);
    assert.deepStrictEqual(ranksOf(createMeld([card("K", "spades"), card("A", "spades"), card("Q", "spades")])!.cards), ["Q", "K", "A"]);
    assert.strictEqual(createMeld([card("K", "spades"), card("A", "spades"), card("2", "spades")]), undefined);
  });

  it("rejects mixed suits and gaps without jokers", () => {
    assert.strictEqual(createMeld([card("4", "hearts"), card("5", "spades"), card("6", "hearts")]), undefined);
    assert.strictEqual(createMeld([card("4", "hearts"), card("6", "hearts"), card("7", "hearts")]), undefined);
  });

  it("places a joker in the gap", () => {
    const meld = createMeld([card("6", "hearts"), joker(), card("4", "hearts")]);
    assert.deepStrictEqual(ranksOf(meld!.cards), ["4", "JOKER", "6"]);
  });

  it("accepts 2 jokers when they are not next to each other", () => {
    const meld = createMeld([card("3", "clubs"), joker(), card("5", "clubs"), joker(), card("7", "clubs")]);
    assert.deepStrictEqual(ranksOf(meld!.cards), ["3", "JOKER", "5", "JOKER", "7"]);
  });

  it("rejects a joker at the end, jokers side by side and more than 2 jokers", () => {
    assert.strictEqual(createMeld([card("4", "hearts"), card("5", "hearts"), joker()]), undefined);
    assert.strictEqual(createMeld([card("4", "hearts"), joker(), joker(), card("7", "hearts")]), undefined);
    assert.strictEqual(createMeld([card("2", "hearts"), joker(), card("4", "hearts"), joker(), card("6", "hearts"), joker(), card("8", "hearts")]), undefined);
  });
});

describe("addToMeld", () => {
  it("adds repeated cards to a trinca, but not the missing suit", () => {
    const set = createMeld([card("5", "hearts"), card("5", "diamonds"), card("5", "clubs")])!;
    assert.strictEqual(addToMeld(set, [card("5", "hearts")])?.cards.length, 4);
    assert.strictEqual(addToMeld(set, [card("5", "spades")]), undefined);
  });

  it("extends a sequência at either end", () => {
    const run = createMeld([card("4", "hearts"), card("5", "hearts"), card("6", "hearts")])!;
    assert.deepStrictEqual(ranksOf(addToMeld(run, [card("7", "hearts"), card("3", "hearts")])!.cards), ["3", "4", "5", "6", "7"]);
    assert.strictEqual(addToMeld(run, [card("8", "hearts")]), undefined);
  });
});

describe("replaceJoker", () => {
  it("swaps the joker for the card it stands for and gives the joker back", () => {
    const run = createMeld([card("4", "hearts"), joker(), card("6", "hearts")])!;
    const result = replaceJoker(run, card("5", "hearts"));
    assert.deepStrictEqual(ranksOf(result!.meld.cards), ["4", "5", "6"]);
    assert.strictEqual(result!.joker.rank, "JOKER");
  });

  it("refuses a card that is not the one the joker stands for", () => {
    const run = createMeld([card("4", "hearts"), joker(), card("6", "hearts")])!;
    assert.strictEqual(replaceJoker(run, card("7", "hearts")), undefined);
  });
});

describe("findMeldInHand", () => {
  it("finds three cards in the hand that form a meld", () => {
    const meld = findMeldInHand([card("K", "spades"), card("4", "hearts"), card("2", "clubs"), card("5", "hearts"), card("6", "hearts")]);
    assert.deepStrictEqual(meld?.map((item) => item.rank).sort(), ["4", "5", "6"]);
  });

  it("returns nothing when no meld exists", () => {
    assert.strictEqual(findMeldInHand([card("K", "spades"), card("4", "hearts"), card("2", "clubs")]), undefined);
  });
});
