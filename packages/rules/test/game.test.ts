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
  players?: string[];
  eliminated?: string[];
  dealer?: string;
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
  const base = startMatch(setup.players ?? PLAYERS, () => 0);
  return {
    ...base,
    players: base.players.map((player) => ({
      ...player,
      hand: setup.hands?.[player.id] ? cards(setup.hands[player.id]) : player.hand,
      points: setup.points?.[player.id] ?? 0,
      eliminated: setup.eliminated?.includes(player.id) ?? false,
    })),
    stock: setup.stock ? cards(setup.stock) : base.stock,
    discard: setup.discard ? cards(setup.discard) : base.discard,
    melds: setup.melds ?? [],
    dealer: setup.dealer ?? base.dealer,
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
    assert.deepStrictEqual(events.at(-1), { type: "roundEnded", wentOut: "ana", reason: "goOut" });
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
  it("offers the return to a player who passes 100 while two or more players stay at 100 or less", () => {
    const game = gameWith({ hands: { ana: ["K-spades-1"], bruno: ["K-hearts-1"], carla: ["2-clubs-1"] }, points: { bruno: 95 }, hasDrawn: true });

    const { game: next, events } = act(game, "ana", { type: "discard", cardId: "K-spades-1" });

    assert.strictEqual(next.phase, "roundOver");
    assert.strictEqual(playerOf(next, "bruno").points, 105);
    assert.strictEqual(playerOf(next, "bruno").eliminated, false);
    assert.strictEqual(playerOf(next, "bruno").awaitingReturn, true);
    assert.deepStrictEqual(events.at(-1), { type: "returnOffered", playerIds: ["bruno"] });
  });

  it("lets a player with exactly 100 points keep playing", () => {
    const game = gameWith({ hands: { ana: ["K-spades-1"], bruno: ["K-hearts-1"], carla: ["2-clubs-1"] }, points: { bruno: 90 }, hasDrawn: true });

    const { game: next, events } = act(game, "ana", { type: "discard", cardId: "K-spades-1" });

    assert.strictEqual(playerOf(next, "bruno").points, 100);
    assert.strictEqual(playerOf(next, "bruno").awaitingReturn, false);
    assert.ok(events.every((event) => event.type !== "returnOffered"));
  });

  it("ends the match when only one player stays at 100 or less, eliminating the others", () => {
    const game = gameWith({
      hands: { ana: ["K-spades-1"], bruno: ["K-hearts-1"], carla: ["Q-hearts-1", "2-hearts-1"] },
      points: { ana: 30, bruno: 95, carla: 100 },
      hasDrawn: true,
    });

    const { game: next, events } = act(game, "ana", { type: "discard", cardId: "K-spades-1" });

    assert.deepStrictEqual(next.players.map((player) => player.points), [30, 105, 112]);
    assert.deepStrictEqual(next.players.map((player) => player.eliminated), [false, true, true]);
    assert.ok(next.players.every((player) => !player.awaitingReturn));
    assert.strictEqual(next.phase, "ended");
    assert.strictEqual(next.winner, "ana");
    assert.deepStrictEqual(events.at(-1), { type: "matchEnded", winner: "ana" });
  });

  it("gives the round to the lowest total when there are no cards left to draw", () => {
    const game = gameWith({
      hands: { ana: ["K-spades-1"], bruno: ["5-clubs-1"], carla: ["9-hearts-1"] },
      points: { ana: 40, bruno: 20, carla: 30 },
      stock: [],
      discard: ["7-spades-2"],
    });

    const { game: next, events } = act(game, "ana", { type: "draw" });

    assert.strictEqual(next.phase, "roundOver");
    assert.strictEqual(next.wentOut, "bruno");
    assert.deepStrictEqual(next.players.map((player) => player.points), [50, 20, 39]);
    assert.deepStrictEqual(next.players.map((player) => player.roundPoints), [10, 0, 9]);
    assert.strictEqual(next.dealer, "bruno");
    assert.deepStrictEqual(events, [{ type: "roundEnded", wentOut: "bruno", reason: "outOfCards" }]);
  });

  it("breaks a tie on the total by the fewest points in hand", () => {
    const game = gameWith({
      hands: { ana: ["K-spades-1"], bruno: ["9-clubs-1"], carla: ["5-hearts-1"] },
      points: { ana: 30, bruno: 20, carla: 20 },
      stock: [],
      discard: ["7-spades-2"],
    });

    const { game: next } = act(game, "ana", { type: "draw" });

    assert.strictEqual(next.wentOut, "carla");
    assert.deepStrictEqual(next.players.map((player) => player.points), [40, 29, 20]);
  });

  it("breaks a tie on the total and on the hand by whoever sits first after the dealer", () => {
    const game = gameWith({
      hands: { ana: ["5-clubs-1"], bruno: ["K-spades-1"], carla: ["5-hearts-1"] },
      points: { ana: 20, bruno: 30, carla: 20 },
      dealer: "bruno",
      stock: [],
      discard: ["7-spades-2"],
    });

    const { game: next } = act(game, "ana", { type: "draw" });

    assert.strictEqual(next.wentOut, "carla");
  });

  it("never gives the round to an eliminated player", () => {
    const game = gameWith({
      hands: { ana: ["K-spades-1"], bruno: ["9-clubs-1"] },
      points: { ana: 40, bruno: 30, carla: 0 },
      eliminated: ["carla"],
      stock: [],
      discard: ["7-spades-2"],
    });

    const { game: next } = act(game, "ana", { type: "draw" });

    assert.strictEqual(next.wentOut, "bruno");
  });

  it("does not deal a new round after the match ended", () => {
    const game = abandonMatch(gameWith());

    assert.strictEqual(startRound(game), game);
  });
});

describe("returning after 100 points", () => {
  const FOUR_PLAYERS = ["ana", "bruno", "carla", "davi"];

  function afterRound(points: Record<string, number>, hands: Record<string, string[]>) {
    const game = gameWith({
      players: FOUR_PLAYERS,
      hands: { ...hands, davi: ["K-spades-1"] },
      points,
      currentTurn: "davi",
      hasDrawn: true,
    });
    return act(game, "davi", { type: "discard", cardId: "K-spades-1" });
  }

  const rulebookExample = () => afterRound({ ana: 100, bruno: 90, carla: 70, davi: 48 }, { ana: ["K-hearts-1"], bruno: ["2-clubs-1"], carla: ["5-clubs-1"] });
  const twoPassed = () => afterRound({ ana: 100, bruno: 100, carla: 70, davi: 48 }, { ana: ["K-hearts-1"], bruno: ["5-clubs-1"], carla: ["2-hearts-1"] });

  it("offers the return to every player who passed 100 while two or more stay", () => {
    const { game, events } = twoPassed();

    assert.deepStrictEqual(game.players.map((player) => player.points), [110, 105, 72, 48]);
    assert.deepStrictEqual(game.players.map((player) => player.awaitingReturn), [true, true, false, false]);
    assert.deepStrictEqual(game.players.map((player) => player.eliminated), [false, false, false, false]);
    assert.deepStrictEqual(events.at(-1), { type: "returnOffered", playerIds: ["ana", "bruno"] });
  });

  it("returns with the highest score among those who stayed, as in the rulebook example", () => {
    const { game } = rulebookExample();
    assert.deepStrictEqual(game.players.map((player) => player.points), [110, 92, 75, 48]);

    const { game: next, events } = act(game, "ana", { type: "chooseReturn", back: true });

    assert.strictEqual(playerOf(next, "ana").points, 92);
    assert.strictEqual(playerOf(next, "ana").awaitingReturn, false);
    assert.strictEqual(playerOf(next, "ana").eliminated, false);
    assert.deepStrictEqual(events, [{ type: "returned", playerId: "ana", points: 92 }]);
  });

  it("is eliminated by choosing not to return", () => {
    const { game } = rulebookExample();

    const { game: next, events } = act(game, "ana", { type: "chooseReturn", back: false });

    assert.strictEqual(playerOf(next, "ana").eliminated, true);
    assert.strictEqual(playerOf(next, "ana").awaitingReturn, false);
    assert.strictEqual(playerOf(next, "ana").points, 110);
    assert.deepStrictEqual(events, [{ type: "eliminated", playerId: "ana" }]);
  });

  it("lets each player who passed decide on their own", () => {
    const { game } = twoPassed();

    const first = act(game, "bruno", { type: "chooseReturn", back: true });
    const second = act(first.game, "ana", { type: "chooseReturn", back: false });

    assert.strictEqual(playerOf(second.game, "bruno").points, 72);
    assert.strictEqual(playerOf(second.game, "ana").eliminated, true);
  });

  it("only deals the next round when every choice is made", () => {
    const { game } = twoPassed();
    assert.strictEqual(startRound(game), game);

    const first = act(game, "ana", { type: "chooseReturn", back: true });
    assert.strictEqual(startRound(first.game), first.game);

    const second = act(first.game, "bruno", { type: "chooseReturn", back: true });
    assert.strictEqual(startRound(second.game).phase, "playing");
  });

  it("deals the next round to the players who returned and skips the ones who left", () => {
    const { game } = twoPassed();
    const returned = act(game, "ana", { type: "chooseReturn", back: true });
    const left = act(returned.game, "bruno", { type: "chooseReturn", back: false });

    const next = startRound(left.game);

    assert.deepStrictEqual(next.players.map((player) => player.hand.length), [9, 0, 9, 9]);
  });

  it("keeps the match going when only two players are left", () => {
    const { game } = twoPassed();
    const first = act(game, "ana", { type: "chooseReturn", back: false });
    const second = act(first.game, "bruno", { type: "chooseReturn", back: false });

    const next = startRound(second.game);

    assert.strictEqual(second.game.phase, "roundOver");
    assert.strictEqual(next.phase, "playing");
    assert.deepStrictEqual(next.players.map((player) => player.hand.length), [0, 0, 9, 9]);
  });

  it("refuses the choice from a player who was not offered the return", () => {
    const { game } = rulebookExample();

    assert.strictEqual(refused(game, "bruno", { type: "chooseReturn", back: true }), "notAllowed");
    assert.strictEqual(refused(game, "davi", { type: "chooseReturn", back: false }), "notAllowed");
  });

  it("refuses a second choice from the same player", () => {
    const { game } = rulebookExample();
    const { game: next } = act(game, "ana", { type: "chooseReturn", back: false });

    assert.strictEqual(refused(next, "ana", { type: "chooseReturn", back: true }), "notAllowed");
  });

  it("refuses the choice after the match was abandoned", () => {
    const { game } = rulebookExample();

    assert.strictEqual(refused(abandonMatch(game), "ana", { type: "chooseReturn", back: true }), "notAllowed");
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
