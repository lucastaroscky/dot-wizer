import assert from "assert";
import {
  abandonMatch,
  applyAction,
  cardById,
  createMeld,
  startMatch,
  startRound,
  type Action,
  type Game,
  type GameError,
  type Meld,
} from "../src/index.js";

const PLAYERS = ["ana", "bruno", "carla"];

type Setup = {
  hands?: Record<string, string[]>;
  points?: Record<string, number>;
  stock?: string[];
  discard?: string[];
  melds?: Meld[];
  currentTurn?: string;
  hasDrawn?: boolean;
  discardIsFree?: boolean;
  lastDiscarder?: string;
};

function cards(ids: string[]) {
  return ids.map(cardById);
}

function meldOf(ids: string[]) {
  const meld = createMeld(cards(ids));
  assert.ok(meld);
  return meld;
}

function gameWith(setup: Setup = {}): Game {
  const base = startMatch(PLAYERS, () => 0);
  return {
    ...base,
    players: base.players.map((player) => ({
      ...player,
      hand: setup.hands?.[player.id] ? cards(setup.hands[player.id]) : player.hand,
      points: setup.points?.[player.id] ?? 0,
    })),
    stock: setup.stock ? cards(setup.stock) : base.stock,
    discard: setup.discard ? cards(setup.discard) : base.discard,
    melds: setup.melds ?? [],
    currentTurn: setup.currentTurn ?? "ana",
    hasDrawn: setup.hasDrawn ?? false,
    discardIsFree: setup.discardIsFree ?? false,
    lastDiscarder: setup.lastDiscarder ?? "",
  };
}

function act(game: Game, playerId: string, action: Action, random = () => 0) {
  const result = applyAction(game, playerId, action, random);
  if ("error" in result) {
    assert.fail(`a jogada foi recusada: ${result.error}`);
  }
  return result;
}

function refused(game: Game, playerId: string, action: Action): GameError {
  const result = applyAction(game, playerId, action);
  if (!("error" in result)) {
    assert.fail("a jogada deveria ser recusada");
  }
  return result.error;
}

function playerOf(game: Game, id: string) {
  const player = game.players.find((candidate) => candidate.id === id);
  assert.ok(player);
  return player;
}

function ranks(meld: Meld) {
  return meld.cards.map((card) => card.rank);
}

describe("startMatch", () => {
  it("deals 9 cards to each player, turns one card up and starts with the player after the dealer", () => {
    const game = startMatch(PLAYERS);

    assert.deepStrictEqual(game.players.map((player) => player.hand.length), [9, 9, 9]);
    assert.strictEqual(game.stock.length, 108 - 27 - 1);
    assert.strictEqual(game.discard.length, 1);
    assert.strictEqual(game.currentTurn, "bruno");
    assert.strictEqual(game.phase, "playing");
  });
});

describe("drawing and discarding", () => {
  it("draws without showing the card, discards and passes the turn", () => {
    const game = gameWith({ hands: { ana: ["2-hearts-1", "9-clubs-1"] }, stock: ["K-spades-1", "5-clubs-1"] });

    const drawn = act(game, "ana", { type: "draw" });
    assert.strictEqual(playerOf(drawn.game, "ana").hand.length, 3);
    assert.strictEqual(drawn.game.discardIsFree, true);
    assert.deepStrictEqual(drawn.events, [{ type: "move", kind: "draw", playerId: "ana", cardIds: [] }]);

    const discarded = act(drawn.game, "ana", { type: "discard", cardId: "2-hearts-1" });
    assert.strictEqual(discarded.game.discard.at(-1)?.id, "2-hearts-1");
    assert.strictEqual(discarded.game.lastDiscarder, "ana");
    assert.strictEqual(discarded.game.currentTurn, "bruno");
    assert.deepStrictEqual(discarded.events.at(-1), { type: "turnStarted", playerId: "bruno" });

    const next = act(discarded.game, "bruno", { type: "draw" });
    assert.strictEqual(next.game.hasDrawn, true);
  });

  it("refuses to act out of turn, to draw twice and to use cards the player does not have", () => {
    const game = gameWith({ hands: { ana: ["7-clubs-1", "7-diamonds-1", "7-spades-1"] } });

    assert.strictEqual(refused(game, "bruno", { type: "draw" }), "notAllowed");
    assert.strictEqual(refused({ ...game, hasDrawn: true }, "ana", { type: "draw" }), "notAllowed");
    assert.strictEqual(refused({ ...game, hasDrawn: true }, "ana", { type: "meld", cardIds: ["K-hearts-2", "7-clubs-1", "7-spades-1"] }), "notAllowed");
  });

  it("asks for a draw before melding or discarding", () => {
    const game = gameWith({ hands: { ana: ["7-clubs-1", "7-diamonds-1", "7-spades-1", "2-hearts-1"] } });

    assert.strictEqual(refused(game, "ana", { type: "meld", cardIds: ["7-clubs-1", "7-diamonds-1", "7-spades-1"] }), "notAllowed");
    assert.strictEqual(refused(game, "ana", { type: "discard", cardId: "2-hearts-1" }), "notAllowed");
  });

  it("never lets a joker be discarded", () => {
    const game = gameWith({ hands: { ana: ["JOKER-1-1", "K-spades-1"] }, hasDrawn: true });

    assert.strictEqual(refused(game, "ana", { type: "discard", cardId: "JOKER-1-1" }), "jokerCannotBeDiscarded");
  });

  it("does not let a card that fits a meld on the table be discarded", () => {
    const game = gameWith({ hands: { ana: ["7-hearts-1", "K-spades-1"] }, melds: [meldOf(["4-hearts-1", "5-hearts-1", "6-hearts-1"])], hasDrawn: true });

    assert.strictEqual(refused(game, "ana", { type: "discard", cardId: "7-hearts-1" }), "cardFitsTable");
  });
});

describe("melds", () => {
  it("lays down a trinca after drawing", () => {
    const game = gameWith({ hands: { ana: ["7-clubs-1", "7-diamonds-1", "7-spades-1", "2-hearts-1"] }, hasDrawn: true });

    const { game: next } = act(game, "ana", { type: "meld", cardIds: ["7-clubs-1", "7-diamonds-1", "7-spades-1"] });

    assert.strictEqual(next.melds[0].kind, "set");
    assert.strictEqual(playerOf(next, "ana").hand.length, 1);
  });

  it("refuses cards that do not form a meld", () => {
    const game = gameWith({ hands: { ana: ["7-clubs-1", "8-diamonds-1", "9-spades-1", "2-hearts-1"] }, hasDrawn: true });

    assert.strictEqual(refused(game, "ana", { type: "meld", cardIds: ["7-clubs-1", "8-diamonds-1", "9-spades-1"] }), "invalidMeld");
  });

  it("lays off a card on a sequência already on the table", () => {
    const game = gameWith({ hands: { ana: ["7-hearts-1", "K-clubs-1"] }, melds: [meldOf(["4-hearts-1", "5-hearts-1", "6-hearts-1"])], hasDrawn: true });

    const { game: next } = act(game, "ana", { type: "layOff", cardIds: ["7-hearts-1"], meldIndex: 0 });

    assert.deepStrictEqual(ranks(next.melds[0]), ["4", "5", "6", "7"]);
  });

  it("takes the discard only to use it in a meld", () => {
    const game = gameWith({ hands: { ana: ["7-clubs-1", "7-diamonds-1", "2-hearts-1"] }, discard: ["7-spades-2"] });

    const { game: next } = act(game, "ana", { type: "takeDiscard", cardIds: ["7-clubs-1", "7-diamonds-1"] });

    assert.strictEqual(next.melds[0].cards.length, 3);
    assert.strictEqual(next.hasDrawn, true);
    assert.strictEqual(next.discard.length, 0);
    assert.strictEqual(playerOf(next, "ana").hand.length, 1);
  });

  it("refuses the discard when it does not form a meld or the player has one card", () => {
    const game = gameWith({ hands: { ana: ["7-clubs-1", "2-hearts-1"] }, discard: ["7-spades-2"] });

    assert.strictEqual(refused(game, "ana", { type: "takeDiscard", cardIds: ["2-hearts-1"] }), "discardNeedsMeld");
    assert.strictEqual(refused(gameWith({ hands: { ana: ["7-clubs-1"] }, discard: ["7-spades-2"] }), "ana", { type: "takeDiscard", cardIds: ["7-clubs-1"] }), "discardWithOneCard");
  });
});

describe("joker swap", () => {
  const tableWithJoker = (hand: string[]) =>
    gameWith({ hands: { ana: hand }, melds: [meldOf(["4-hearts-1", "JOKER-1-1", "6-hearts-1"])], hasDrawn: true });

  it("swaps a joker on the table and puts it straight into a new meld", () => {
    const game = tableWithJoker(["5-hearts-1", "8-clubs-1", "10-clubs-1", "K-spades-1"]);

    const { game: next } = act(game, "ana", { type: "layOff", cardIds: ["5-hearts-1"], meldIndex: 0, jokerTo: { cardIds: ["8-clubs-1", "10-clubs-1"] } });

    assert.deepStrictEqual(ranks(next.melds[0]), ["4", "5", "6"]);
    assert.deepStrictEqual(ranks(next.melds[1]), ["8", "JOKER", "10"]);
    assert.deepStrictEqual(playerOf(next, "ana").hand.map((card) => card.rank), ["K"]);
  });

  it("does not swap a joker without saying where it goes", () => {
    const game = tableWithJoker(["5-hearts-1", "8-clubs-1", "10-clubs-1", "K-spades-1"]);

    assert.strictEqual(refused(game, "ana", { type: "layOff", cardIds: ["5-hearts-1"], meldIndex: 0 }), "jokerNeedsPlace");
  });

  it("does not let the swapped joker sit at the end of a meld", () => {
    const game = tableWithJoker(["5-hearts-1", "8-clubs-1", "10-clubs-1", "K-spades-1"]);

    assert.strictEqual(refused(game, "ana", { type: "layOff", cardIds: ["5-hearts-1"], meldIndex: 0, jokerTo: { meldIndex: 0, cardIds: [] } }), "jokerPlacement");
  });

  it("lets the swapped joker sit at the end when the player is going out", () => {
    const game = tableWithJoker(["5-hearts-1", "8-clubs-1", "9-clubs-1", "K-spades-1"]);

    const { game: next } = act(game, "ana", { type: "layOff", cardIds: ["5-hearts-1"], meldIndex: 0, jokerTo: { cardIds: ["8-clubs-1", "9-clubs-1"] } });

    assert.deepStrictEqual(ranks(next.melds[1]), ["8", "9", "JOKER"]);
  });
});

describe("going out", () => {
  it("goes out by playing every card on the table, without a discard", () => {
    const game = gameWith({ hands: { ana: ["7-clubs-1", "7-diamonds-1", "7-spades-1"] }, hasDrawn: true });

    const { game: next, events } = act(game, "ana", { type: "meld", cardIds: ["7-clubs-1", "7-diamonds-1", "7-spades-1"] });

    assert.strictEqual(next.phase, "roundOver");
    assert.strictEqual(next.wentOut, "ana");
    assert.deepStrictEqual(events.at(-1), { type: "roundEnded", wentOut: "ana" });
  });

  it("goes out on their own turn by discarding the last card, then the next dealer deals a new round", () => {
    const game = gameWith({ hands: { ana: ["K-spades-1"] }, hasDrawn: true });

    const { game: ended } = act(game, "ana", { type: "discard", cardId: "K-spades-1" });
    assert.strictEqual(ended.phase, "roundOver");

    const next = startRound(ended);
    assert.strictEqual(next.phase, "playing");
    assert.deepStrictEqual(next.players.map((player) => player.hand.length), [9, 9, 9]);
    assert.strictEqual(next.dealer, "bruno");
    assert.strictEqual(next.currentTurn, "carla");
  });

  it("goes out of turn with the free discard and ends the round", () => {
    const game = gameWith({
      hands: { bruno: ["7-clubs-1", "7-diamonds-1", "4-hearts-1", "5-hearts-1", "6-hearts-1", "K-spades-1"] },
      discard: ["7-spades-2"],
      hasDrawn: true,
      discardIsFree: true,
    });

    const { game: next } = act(game, "bruno", { type: "goOut" });

    assert.strictEqual(next.phase, "roundOver");
    assert.strictEqual(playerOf(next, "bruno").points, 0);
    assert.strictEqual(next.discard.at(-1)?.id, "K-spades-1");
    assert.ok(playerOf(next, "ana").points > 0);
  });

  it("lets another player go out with the discard while the next player thinks", () => {
    const game = gameWith({ hands: { ana: ["7-spades-2", "K-hearts-1"], carla: ["7-clubs-1", "7-diamonds-1", "2-hearts-1"] }, hasDrawn: true });
    const discarded = act(game, "ana", { type: "discard", cardId: "7-spades-2" });
    const drawn = act(discarded.game, "bruno", { type: "draw" });

    const { game: next } = act(drawn.game, "carla", { type: "goOut" });

    assert.strictEqual(next.wentOut, "carla");
    assert.strictEqual(playerOf(next, "ana").roundPoints, 10);
    assert.strictEqual(playerOf(next, "carla").roundPoints, 0);
  });

  it("only lets players other than the current one and the last discarder go out with the discard", () => {
    const game = gameWith({ discard: ["7-spades-2"], hasDrawn: true, discardIsFree: true, lastDiscarder: "carla" });

    assert.strictEqual(refused(game, "ana", { type: "goOut" }), "notYourTurnToGoOut");
    assert.strictEqual(refused(game, "carla", { type: "goOut" }), "notYourTurnToGoOut");
    assert.strictEqual(refused({ ...game, discardIsFree: false }, "bruno", { type: "goOut" }), "notYourTurnToGoOut");
  });

  it("blocks going out of turn again after a bluff, without adding points", () => {
    const game = gameWith({ hands: { bruno: ["2-clubs-1", "9-diamonds-1", "K-spades-1"] }, discard: ["7-spades-2"], hasDrawn: true, discardIsFree: true });

    const { game: next, events } = act(game, "bruno", { type: "goOut" });

    assert.strictEqual(next.phase, "playing");
    assert.strictEqual(playerOf(next, "bruno").points, 0);
    assert.strictEqual(playerOf(next, "bruno").bluffed, true);
    assert.deepStrictEqual(events, [{ type: "bluffed", playerId: "bruno" }]);
    assert.strictEqual(refused(next, "bruno", { type: "goOut" }), "alreadyBluffed");
  });
});

describe("end of round and match", () => {
  it("eliminates a player who passes 100 points", () => {
    const game = gameWith({ hands: { ana: ["K-spades-1"], bruno: ["K-hearts-1"] }, points: { bruno: 95 }, hasDrawn: true });

    const { game: next } = act(game, "ana", { type: "discard", cardId: "K-spades-1" });

    assert.strictEqual(playerOf(next, "bruno").eliminated, true);
    assert.strictEqual(next.phase, "roundOver");
  });

  it("ends the match when only one player is left", () => {
    const game = gameWith({ hands: { ana: ["K-spades-1"], bruno: ["K-hearts-1"], carla: ["Q-hearts-1"] }, points: { bruno: 95, carla: 95 }, hasDrawn: true });

    const { game: next, events } = act(game, "ana", { type: "discard", cardId: "K-spades-1" });

    assert.strictEqual(next.phase, "ended");
    assert.strictEqual(next.winner, "ana");
    assert.deepStrictEqual(events.at(-1), { type: "matchEnded", winner: "ana" });
  });

  it("ends the round without a winner when there are no cards left to draw", () => {
    const game = gameWith({ stock: [], discard: ["7-spades-2"] });

    const { game: next, events } = act(game, "ana", { type: "draw" });

    assert.strictEqual(next.phase, "roundOver");
    assert.strictEqual(next.wentOut, "");
    assert.ok(next.players.every((player) => player.points === 0));
    assert.deepStrictEqual(events, [{ type: "roundEnded", wentOut: "" }]);
  });

  it("does not deal a new round after the match ended", () => {
    const game = abandonMatch(gameWith());

    assert.strictEqual(startRound(game), game);
  });
});

describe("automatic play", () => {
  it("draws and discards a random card for a player who did nothing", () => {
    const game = gameWith({ hands: { ana: ["2-hearts-1", "6-hearts-1", "10-hearts-1"] }, stock: ["Q-spades-1"] });

    const { game: next } = act(game, "ana", { type: "playAutomatically" }, () => 0.99);

    assert.strictEqual(next.discard.at(-1)?.id, "Q-spades-1");
    assert.strictEqual(playerOf(next, "ana").hand.length, 3);
    assert.strictEqual(next.currentTurn, "bruno");
  });

  it("lays off fitting cards before discarding", () => {
    const game = gameWith({ hands: { ana: ["7-hearts-1", "K-spades-1", "2-clubs-1"] }, melds: [meldOf(["4-hearts-1", "5-hearts-1", "6-hearts-1"])], hasDrawn: true });

    const { game: next } = act(game, "ana", { type: "playAutomatically" });

    assert.strictEqual(next.melds[0].cards.length, 4);
    assert.strictEqual(next.lastDiscarder, "ana");
  });

  it("passes the turn without a discard when only jokers are left", () => {
    const game = gameWith({ hands: { ana: ["JOKER-1-1", "JOKER-1-2"] }, hasDrawn: true });

    const { game: next } = act(game, "ana", { type: "playAutomatically" });

    assert.strictEqual(playerOf(next, "ana").hand.length, 2);
    assert.strictEqual(next.currentTurn, "bruno");
    assert.strictEqual(next.discardIsFree, false);
  });
});
