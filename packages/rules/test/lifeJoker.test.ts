import assert from "assert";
import {
  addToMeld,
  applyAction,
  canDiscard,
  cardById,
  createMeld,
  findGoOut,
  findMeldInHand,
  flipCard,
  handPoints,
  isJoker,
  lifeJokerFor,
  replaceJoker,
  startMatch,
  startRound,
  TRAINING_MAX_PLAYERS,
  type Game,
} from "../src/index.js";

function cards(ids: string[]) {
  return ids.map(cardById);
}

const twoOfRed = lifeJokerFor({ rank: "A", suit: "hearts" });

describe("lifeJokerFor", () => {
  it("is the next rank in both suits of the flipped card's color", () => {
    assert.deepStrictEqual(lifeJokerFor({ rank: "A", suit: "hearts" }), { rank: "2", suits: ["hearts", "diamonds"] });
    assert.deepStrictEqual(lifeJokerFor({ rank: "10", suit: "clubs" }), { rank: "J", suits: ["spades", "clubs"] });
  });

  it("is the ace when the king is flipped", () => {
    assert.deepStrictEqual(lifeJokerFor({ rank: "K", suit: "spades" }), { rank: "A", suits: ["spades", "clubs"] });
  });
});

describe("flipCard", () => {
  it("takes the top card of the stock", () => {
    const stock = cards(["7-clubs-1", "8-clubs-1", "9-clubs-1"]);

    const result = flipCard(stock);

    assert.strictEqual(result.flipped.id, "7-clubs-1");
    assert.deepStrictEqual(result.stock.map((card) => card.id), ["8-clubs-1", "9-clubs-1"]);
  });

  it("sends a flipped coringão to the bottom of the stock and flips the next card", () => {
    const stock = cards(["JOKER-1-1", "JOKER-2-1", "7-clubs-1", "8-clubs-1"]);

    const result = flipCard(stock);

    assert.strictEqual(result.flipped.id, "7-clubs-1");
    assert.deepStrictEqual(result.stock.map((card) => card.id), ["8-clubs-1", "JOKER-1-1", "JOKER-2-1"]);
  });
});

describe("life joker as a coringa", () => {
  it("is a joker only in the two suits of the color", () => {
    assert.strictEqual(isJoker(cardById("2-hearts-1"), twoOfRed), true);
    assert.strictEqual(isJoker(cardById("2-diamonds-2"), twoOfRed), true);
    assert.strictEqual(isJoker(cardById("2-spades-1"), twoOfRed), false);
    assert.strictEqual(isJoker(cardById("2-hearts-1")), false);
  });

  it("counts 20 points in the hand", () => {
    assert.strictEqual(handPoints(cards(["2-hearts-1", "2-spades-1"]), twoOfRed), 22);
  });

  it("cannot be discarded", () => {
    assert.strictEqual(canDiscard(cardById("2-hearts-1"), [], { wild: twoOfRed }), false);
    assert.strictEqual(canDiscard(cardById("2-spades-1"), [], { wild: twoOfRed }), true);
  });

  it("fills the gap of a sequência of another suit", () => {
    const meld = createMeld(cards(["5-clubs-1", "2-hearts-1", "7-clubs-1"]), { wild: twoOfRed });

    assert.deepStrictEqual(meld?.cards.map((card) => card.id), ["5-clubs-1", "2-hearts-1", "7-clubs-1"]);
  });

  it("counts as a joker in its own suit, inside the limit of 2", () => {
    assert.strictEqual(createMeld(cards(["A-hearts-1", "2-hearts-1", "3-hearts-1"]), { wild: twoOfRed })?.kind, "run");
    assert.strictEqual(createMeld(cards(["2-hearts-1", "2-diamonds-1", "JOKER-1-1", "3-clubs-1"]), { wild: twoOfRed, goingOut: true }), undefined);
  });

  it("never enters a trinca", () => {
    assert.strictEqual(createMeld(cards(["2-clubs-1", "2-spades-1", "2-hearts-1"]), { wild: twoOfRed }), undefined);
    const set = createMeld(cards(["2-clubs-1", "2-spades-1", "2-diamonds-1"]));
    assert.ok(set);
    assert.strictEqual(addToMeld(set, cards(["2-diamonds-2"]), { wild: twoOfRed }), undefined);
  });

  it("can be swapped for the real card on the table", () => {
    const run = createMeld(cards(["5-clubs-1", "2-hearts-1", "7-clubs-1"]), { wild: twoOfRed });
    assert.ok(run);

    const swap = replaceJoker(run, cardById("6-clubs-1"), { wild: twoOfRed });

    assert.strictEqual(swap?.joker.id, "2-hearts-1");
    assert.deepStrictEqual(swap?.meld.cards.map((card) => card.id), ["5-clubs-1", "6-clubs-1", "7-clubs-1"]);
  });

  it("is found by the robots and by the batida", () => {
    assert.ok(findMeldInHand(cards(["5-clubs-1", "K-spades-1", "2-hearts-1", "7-clubs-1"]), { wild: twoOfRed }));
    assert.ok(findGoOut(cards(["5-clubs-1", "2-hearts-1", "7-clubs-1"]), [], { wild: twoOfRed }));
  });
});

describe("match with the life joker", () => {
  function allCards(game: Game) {
    return [...game.players.flatMap((player) => player.hand), ...game.stock, ...game.discard, ...(game.flipped ? [game.flipped] : [])];
  }

  it("flips a card out of the stock at the start of each round", () => {
    const game = startMatch(["ana", "bruno", "carla"], { lifeJoker: true }, () => 0);

    assert.ok(game.flipped);
    assert.notStrictEqual(game.flipped.rank, "JOKER");
    assert.ok(!game.stock.some((card) => card.id === game.flipped?.id));
    assert.strictEqual(new Set(allCards(game).map((card) => card.id)).size, 108);
  });

  it("does not flip a card when only the coringão is used", () => {
    const game = startMatch(["ana", "bruno", "carla"], { lifeJoker: false }, () => 0);

    assert.strictEqual(game.flipped, undefined);
    assert.strictEqual(allCards(game).length, 108);
  });

  it("flips again on the next round", () => {
    const first = startMatch(["ana", "bruno", "carla"], { lifeJoker: true }, () => 0);

    const next = startRound({ ...first, phase: "roundOver" }, () => 0.5);

    assert.ok(next.flipped);
    assert.strictEqual(new Set(allCards(next).map((card) => card.id)).size, 108);
  });

  it("refuses to discard the life joker", () => {
    const base = startMatch(["ana", "bruno", "carla"], { lifeJoker: true }, () => 0);
    const game: Game = {
      ...base,
      flipped: { id: "A-hearts-1", rank: "A", suit: "hearts" },
      currentTurn: "ana",
      hasDrawn: true,
      players: base.players.map((player) => ({ ...player, hand: player.id === "ana" ? cards(["2-hearts-1", "K-spades-1"]) : player.hand })),
    };

    assert.deepStrictEqual(applyAction(game, "ana", { type: "discard", cardId: "2-hearts-1" }), { error: "jokerCannotBeDiscarded" });
  });

  it("deals to up to 6 players in the training match", () => {
    const ids = Array.from({ length: TRAINING_MAX_PLAYERS }, (_, seat) => `p${seat}`);

    const game = startMatch(ids, { lifeJoker: true });

    assert.deepStrictEqual(game.players.map((player) => player.hand.length), [9, 9, 9, 9, 9, 9]);
    assert.strictEqual(new Set(allCards(game).map((card) => card.id)).size, 108);
  });
});
