import { dealRound, drawFromStock, ELIMINATION_POINTS, handPoints, type Card } from "./cards.ts";
import { addToMeld, canDiscard, createMeld, findGoOut, findMeldInHand, isJoker, replaceJoker, type Meld } from "./melds.ts";

export type Phase = "playing" | "roundOver" | "ended";

export type GamePlayer = {
  id: string;
  hand: Card[];
  points: number;
  roundPoints: number;
  eliminated: boolean;
  bluffed: boolean;
};

export type Game = {
  players: GamePlayer[];
  phase: Phase;
  dealer: string;
  currentTurn: string;
  hasDrawn: boolean;
  discardIsFree: boolean;
  lastDiscarder: string;
  stock: Card[];
  discard: Card[];
  melds: Meld[];
  wentOut: string;
  winner: string;
};

export type JokerTarget = { meldIndex?: number; cardIds: string[] };

export type Action =
  | { type: "draw" }
  | { type: "takeDiscard"; cardIds: string[]; meldIndex?: number }
  | { type: "meld"; cardIds: string[] }
  | { type: "layOff"; cardIds: string[]; meldIndex: number; jokerTo?: JokerTarget }
  | { type: "discard"; cardId: string }
  | { type: "goOut" }
  | { type: "playAutomatically" };

export type MoveKind = "draw" | "toTable" | "discard";

export type GameEvent =
  | { type: "move"; kind: MoveKind; playerId: string; cardIds: string[] }
  | { type: "turnStarted"; playerId: string }
  | { type: "bluffed"; playerId: string }
  | { type: "roundEnded"; wentOut: string }
  | { type: "matchEnded"; winner: string };

export type GameError =
  | "notAllowed"
  | "discardWithOneCard"
  | "discardNeedsMeld"
  | "invalidMeld"
  | "invalidLayOff"
  | "jokerNeedsPlace"
  | "jokerPlacement"
  | "jokerCannotBeDiscarded"
  | "cardFitsTable"
  | "notYourTurnToGoOut"
  | "alreadyBluffed";

export type ActionResult = { game: Game; events: GameEvent[] } | { error: GameError };

type Random = () => number;

export function startMatch(playerIds: string[], random: Random = Math.random): Game {
  const players = playerIds.map((id) => ({ id, hand: [], points: 0, roundPoints: 0, eliminated: false, bluffed: false }));
  const game: Game = {
    players,
    phase: "roundOver",
    dealer: playerIds[0],
    currentTurn: "",
    hasDrawn: false,
    discardIsFree: false,
    lastDiscarder: "",
    stock: [],
    discard: [],
    melds: [],
    wentOut: "",
    winner: "",
  };
  return startRound(game, random);
}

export function startRound(game: Game, random: Random = Math.random): Game {
  if (game.phase !== "roundOver") {
    return game;
  }
  const next = clone(game);
  const active = next.players.filter((player) => !player.eliminated);
  const round = dealRound(active.length, random);

  for (const player of next.players) {
    player.hand = [];
    player.roundPoints = 0;
    player.bluffed = false;
  }
  active.forEach((player, seat) => {
    player.hand = round.hands[seat];
  });
  next.stock = round.stock;
  next.discard = round.discard;
  next.melds = [];
  next.wentOut = "";
  next.currentTurn = nextActive(next, next.dealer);
  next.hasDrawn = false;
  next.discardIsFree = false;
  next.lastDiscarder = "";
  next.phase = "playing";
  return next;
}

export function abandonMatch(game: Game): Game {
  return { ...game, phase: "ended" };
}

export function applyAction(game: Game, playerId: string, action: Action, random: Random = Math.random): ActionResult {
  const next = clone(game);
  const player = next.players.find((candidate) => candidate.id === playerId);
  if (!player) {
    return { error: "notAllowed" };
  }
  const events: GameEvent[] = [];
  const error = run(next, player, action, events, random);
  if (error) {
    return { error };
  }
  return { game: next, events };
}

function run(game: Game, player: GamePlayer, action: Action, events: GameEvent[], random: Random): GameError | undefined {
  switch (action.type) {
    case "draw":
      return draw(game, player, events, random);
    case "takeDiscard":
      return takeDiscard(game, player, action.cardIds, action.meldIndex, events);
    case "meld":
      return meld(game, player, action.cardIds, events);
    case "layOff":
      return layOff(game, player, action.cardIds, action.meldIndex, action.jokerTo, events);
    case "discard":
      return discard(game, player, action.cardId, events);
    case "goOut":
      return goOut(game, player, events);
    case "playAutomatically":
      return playAutomatically(game, player, events, random);
  }
}

function draw(game: Game, player: GamePlayer, events: GameEvent[], random: Random) {
  if (!isTurnOf(game, player) || game.hasDrawn) {
    return "notAllowed";
  }
  drawCard(game, player, events, random);
  return undefined;
}

function takeDiscard(game: Game, player: GamePlayer, cardIds: string[], meldIndex: number | undefined, events: GameEvent[]) {
  const cards = cardIds.length === 0 ? [] : cardsInHand(player, cardIds);
  const top = game.discard.at(-1);
  const target = meldIndex === undefined ? undefined : game.melds[meldIndex];
  if (!cards || !top || !isTurnOf(game, player) || game.hasDrawn || (meldIndex !== undefined && !target)) {
    return "notAllowed";
  }
  if (player.hand.length === 1) {
    return "discardWithOneCard";
  }
  const goingOut = { goingOut: player.hand.length - cards.length <= 1 };
  const placed = target ? addToMeld(target, [top, ...cards], goingOut) : createMeld([top, ...cards], goingOut);
  if (!placed) {
    return "discardNeedsMeld";
  }

  game.discard = game.discard.slice(0, -1);
  removeFromHand(player, cards);
  placeMeld(game, placed, meldIndex);
  events.push(move("toTable", player, [top, ...cards]));
  game.hasDrawn = true;
  game.discardIsFree = false;
  endRoundIfEmpty(game, player, events);
  return undefined;
}

function meld(game: Game, player: GamePlayer, cardIds: string[], events: GameEvent[]) {
  const cards = cardsInHand(player, cardIds);
  if (!cards || !isTurnOf(game, player) || !game.hasDrawn) {
    return "notAllowed";
  }
  const created = createMeld(cards, { goingOut: player.hand.length - cards.length <= 1 });
  if (!created) {
    return "invalidMeld";
  }
  removeFromHand(player, cards);
  placeMeld(game, created);
  events.push(move("toTable", player, cards));
  endRoundIfEmpty(game, player, events);
  return undefined;
}

function layOff(game: Game, player: GamePlayer, cardIds: string[], meldIndex: number, jokerTo: JokerTarget | undefined, events: GameEvent[]) {
  const cards = cardsInHand(player, cardIds);
  const target = game.melds[meldIndex];
  if (!cards || !target || !isTurnOf(game, player) || !game.hasDrawn) {
    return "notAllowed";
  }
  const extended = addToMeld(target, cards, { goingOut: player.hand.length - cards.length <= 1 });
  if (!extended) {
    return swapJoker(game, player, cards, meldIndex, jokerTo, events);
  }
  removeFromHand(player, cards);
  placeMeld(game, extended, meldIndex);
  events.push(move("toTable", player, cards));
  endRoundIfEmpty(game, player, events);
  return undefined;
}

function swapJoker(game: Game, player: GamePlayer, cards: Card[], meldIndex: number, jokerTo: JokerTarget | undefined, events: GameEvent[]) {
  const swap = cards.length === 1 ? replaceJoker(game.melds[meldIndex], cards[0]) : undefined;
  if (!swap) {
    return "invalidLayOff";
  }
  if (!jokerTo) {
    return "jokerNeedsPlace";
  }
  const extraCards = jokerTo.cardIds.length === 0 ? [] : cardsInHand(player, jokerTo.cardIds);
  if (!extraCards || extraCards.some((card) => card.id === cards[0].id)) {
    return "notAllowed";
  }

  const table = game.melds.map((current, index) => (index === meldIndex ? swap.meld : current));
  const jokerTarget = jokerTo.meldIndex === undefined ? undefined : table[jokerTo.meldIndex];
  const goingOut = { goingOut: player.hand.length - cards.length - extraCards.length <= 1 };
  const jokerMeld = jokerTarget ? addToMeld(jokerTarget, [swap.joker, ...extraCards], goingOut) : createMeld([swap.joker, ...extraCards], goingOut);
  if (!jokerMeld) {
    return "jokerPlacement";
  }

  removeFromHand(player, [...cards, ...extraCards]);
  placeMeld(game, swap.meld, meldIndex);
  placeMeld(game, jokerMeld, jokerTarget ? jokerTo.meldIndex : undefined);
  events.push(move("toTable", player, [...cards, ...extraCards]));
  endRoundIfEmpty(game, player, events);
  return undefined;
}

function discard(game: Game, player: GamePlayer, cardId: string, events: GameEvent[]) {
  const cards = cardsInHand(player, [cardId]);
  if (!cards || !isTurnOf(game, player) || !game.hasDrawn) {
    return "notAllowed";
  }
  const [card] = cards;
  if (isJoker(card)) {
    return "jokerCannotBeDiscarded";
  }
  if (!canDiscard(card, game.melds)) {
    return "cardFitsTable";
  }
  discardCard(game, player, card, events);
  return undefined;
}

function goOut(game: Game, player: GamePlayer, events: GameEvent[]) {
  const top = game.discard.at(-1);
  if (player.eliminated || !top || game.phase !== "playing") {
    return "notAllowed";
  }
  if (!canGoOutWithDiscard(game, player)) {
    return "notYourTurnToGoOut";
  }
  if (player.bluffed) {
    return "alreadyBluffed";
  }

  const found = findGoOut([...player.hand, top], game.melds, top);
  if (!found) {
    player.bluffed = true;
    events.push({ type: "bluffed", playerId: player.id });
    return undefined;
  }

  const hand = player.hand;
  game.discard = found.discard ? [...game.discard.slice(0, -1), found.discard] : game.discard.slice(0, -1);
  player.hand = [];
  game.melds = found.table;
  events.push(move("toTable", player, hand));
  endRound(game, player, events);
  return undefined;
}

function playAutomatically(game: Game, player: GamePlayer, events: GameEvent[], random: Random) {
  if (!isTurnOf(game, player)) {
    return "notAllowed";
  }
  if (!game.hasDrawn) {
    drawCard(game, player, events, random);
  }
  if (game.phase !== "playing") {
    return undefined;
  }

  meldEverythingPossible(game, player, events);
  layOffEverythingThatFits(game, player, events);
  if (player.hand.length === 0) {
    endRound(game, player, events);
    return undefined;
  }

  const discardable = player.hand.filter((card) => canDiscard(card, game.melds));
  if (discardable.length === 0) {
    game.hasDrawn = false;
    game.discardIsFree = false;
    passTurn(game, events);
    return undefined;
  }
  discardCard(game, player, discardable[Math.floor(random() * discardable.length)], events);
  return undefined;
}

function meldEverythingPossible(game: Game, player: GamePlayer, events: GameEvent[]) {
  for (let cards = findMeldInHand(player.hand); cards; cards = findMeldInHand(player.hand)) {
    const created = createMeld(cards, { goingOut: player.hand.length - cards.length <= 1 });
    if (!created) {
      return;
    }
    removeFromHand(player, cards);
    placeMeld(game, created);
    events.push(move("toTable", player, cards));
  }
}

function layOffEverythingThatFits(game: Game, player: GamePlayer, events: GameEvent[]) {
  for (const card of [...player.hand]) {
    const goingOut = { goingOut: player.hand.length <= 2 };
    const meldIndex = game.melds.findIndex((current) => addToMeld(current, [card], goingOut));
    const extended = meldIndex === -1 ? undefined : addToMeld(game.melds[meldIndex], [card], goingOut);
    if (!extended) {
      continue;
    }
    removeFromHand(player, [card]);
    placeMeld(game, extended, meldIndex);
    events.push(move("toTable", player, [card]));
  }
}

function drawCard(game: Game, player: GamePlayer, events: GameEvent[], random: Random) {
  const result = drawFromStock({ stock: game.stock, discard: game.discard }, random);
  if (!result) {
    endRoundWithoutCards(game, events);
    return;
  }
  game.stock = result.stock;
  game.discard = result.discard;
  player.hand = [...player.hand, result.card];
  game.hasDrawn = true;
  game.discardIsFree = true;
  events.push(move("draw", player, []));
}

function discardCard(game: Game, player: GamePlayer, card: Card, events: GameEvent[]) {
  removeFromHand(player, [card]);
  game.discard = [...game.discard, card];
  events.push(move("discard", player, [card]));
  if (player.hand.length === 0) {
    endRound(game, player, events);
    return;
  }
  game.hasDrawn = false;
  game.discardIsFree = false;
  game.lastDiscarder = player.id;
  passTurn(game, events);
}

function endRoundIfEmpty(game: Game, player: GamePlayer, events: GameEvent[]) {
  if (player.hand.length === 0) {
    endRound(game, player, events);
  }
}

function endRound(game: Game, winner: GamePlayer, events: GameEvent[]) {
  for (const player of game.players) {
    if (player === winner || player.eliminated) {
      continue;
    }
    player.roundPoints = handPoints(player.hand);
    player.points += player.roundPoints;
    player.eliminated = player.points > ELIMINATION_POINTS;
  }
  game.wentOut = winner.id;
  game.phase = "roundOver";
  events.push({ type: "roundEnded", wentOut: winner.id });

  const remaining = game.players.filter((player) => !player.eliminated);
  if (remaining.length <= 1) {
    game.winner = remaining[0]?.id ?? "";
    game.phase = "ended";
    events.push({ type: "matchEnded", winner: game.winner });
    return;
  }
  game.dealer = nextActive(game, game.dealer);
}

function endRoundWithoutCards(game: Game, events: GameEvent[]) {
  game.phase = "roundOver";
  game.dealer = nextActive(game, game.dealer);
  events.push({ type: "roundEnded", wentOut: "" });
}

function passTurn(game: Game, events: GameEvent[]) {
  game.currentTurn = nextActive(game, game.currentTurn);
  events.push({ type: "turnStarted", playerId: game.currentTurn });
}

function nextActive(game: Game, playerId: string) {
  const seat = game.players.findIndex((player) => player.id === playerId);
  for (let step = 1; step <= game.players.length; step++) {
    const candidate = game.players[(seat + step) % game.players.length];
    if (!candidate.eliminated) {
      return candidate.id;
    }
  }
  return playerId;
}

function isTurnOf(game: Game, player: GamePlayer) {
  return game.phase === "playing" && game.currentTurn === player.id;
}

function canGoOutWithDiscard(game: Game, player: GamePlayer) {
  return game.discardIsFree && player.id !== game.currentTurn && player.id !== game.lastDiscarder;
}

function cardsInHand(player: GamePlayer, cardIds: string[]) {
  const cards = cardIds.map((id) => player.hand.find((card) => card.id === id)).filter((card) => card !== undefined);
  if (cards.length === 0 || cards.length !== cardIds.length || new Set(cardIds).size !== cardIds.length) {
    return undefined;
  }
  return cards;
}

function removeFromHand(player: GamePlayer, cards: Card[]) {
  const ids = new Set(cards.map((card) => card.id));
  player.hand = player.hand.filter((card) => !ids.has(card.id));
}

function placeMeld(game: Game, meld: Meld, meldIndex?: number) {
  if (meldIndex === undefined) {
    game.melds = [...game.melds, meld];
    return;
  }
  game.melds = game.melds.map((current, index) => (index === meldIndex ? meld : current));
}

function move(kind: MoveKind, player: GamePlayer, cards: Card[]): GameEvent {
  return { type: "move", kind, playerId: player.id, cardIds: cards.map((card) => card.id) };
}

function clone(game: Game): Game {
  return {
    ...game,
    players: game.players.map((player) => ({ ...player, hand: [...player.hand] })),
    stock: [...game.stock],
    discard: [...game.discard],
    melds: [...game.melds],
  };
}
