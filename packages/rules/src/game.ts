import { dealRound, drawFromStock, ELIMINATION_POINTS, flipCard, handPoints, isJoker, lifeJokerFor, secureRandom, type Card, type NaturalCard } from "./cards.ts";
import { addToMeld, canDiscard, createMeld, findGoOut, findMeldInHand, replaceJoker, type Meld } from "./melds.ts";

export type Phase = "playing" | "roundOver" | "ended";

export type GamePlayer = {
  id: string;
  hand: Card[];
  points: number;
  roundPoints: number;
  eliminated: boolean;
  sittingOut: boolean;
  leftMatch: boolean;
  awaitingReturn: boolean;
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
  lifeJoker: boolean;
  flipped?: NaturalCard;
};

export type JokerTarget = { meldIndex?: number; cardIds: string[] };

export type Action =
  | { type: "draw" }
  | { type: "takeDiscard"; cardIds: string[]; meldIndex?: number }
  | { type: "meld"; cardIds: string[] }
  | { type: "layOff"; cardIds: string[]; meldIndex: number; jokerTo?: JokerTarget }
  | { type: "discard"; cardId: string }
  | { type: "goOut" }
  | { type: "chooseReturn"; back: boolean }
  | { type: "leaveMatch" }
  | { type: "rejoinMatch" }
  | { type: "playAutomatically" }
  | { type: "playMovementOnly" };

export type MoveKind = "draw" | "toTable" | "discard";

export type RoundEndReason = "goOut" | "outOfCards";

export type MatchEndReason = "points" | "walkover";

export const MIN_PLAYERS = 3;
export const ONLINE_MAX_PLAYERS = 4;
export const TRAINING_MAX_PLAYERS = 6;

const MIN_PLAYERS_TO_CONTINUE = 2;

export type GameEvent =
  | { type: "move"; kind: MoveKind; playerId: string; cardIds: string[] }
  | { type: "turnStarted"; playerId: string }
  | { type: "bluffed"; playerId: string }
  | { type: "roundEnded"; wentOut: string; reason: RoundEndReason }
  | { type: "returnOffered"; playerIds: string[] }
  | { type: "returned"; playerId: string; points: number }
  | { type: "eliminated"; playerId: string }
  | { type: "matchEnded"; winner: string; reason: MatchEndReason };

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

export function startMatch(playerIds: string[], { lifeJoker }: { lifeJoker: boolean }, random: Random = secureRandom): Game {
  const players = playerIds.map((id) => ({ id, hand: [], points: 0, roundPoints: 0, eliminated: false, sittingOut: false, leftMatch: false, awaitingReturn: false, bluffed: false }));
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
    lifeJoker,
  };
  return startRound(game, random);
}

export function startRound(game: Game, random: Random = secureRandom): Game {
  if (game.phase !== "roundOver" || game.players.some((player) => player.awaitingReturn)) {
    return game;
  }
  const next = clone(game);
  for (const player of next.players) {
    player.sittingOut = player.leftMatch;
  }
  const dealer = next.players.find((player) => player.id === next.dealer);
  if (dealer && !isPlaying(dealer)) {
    next.dealer = nextActive(next, next.dealer);
  }
  const active = next.players.filter(isPlaying);
  const round = dealRound(active.length, random);

  for (const player of next.players) {
    player.hand = [];
    player.roundPoints = 0;
    player.bluffed = false;
  }
  active.forEach((player, seat) => {
    player.hand = round.hands[seat];
  });
  const flip = next.lifeJoker ? flipCard(round.stock) : { stock: round.stock, flipped: undefined };
  next.stock = flip.stock;
  next.flipped = flip.flipped;
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

export function applyAction(game: Game, playerId: string, action: Action, random: Random = secureRandom): ActionResult {
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
    case "chooseReturn":
      return chooseReturn(game, player, action.back, events);
    case "leaveMatch":
      return leaveMatch(game, player, events);
    case "rejoinMatch":
      return rejoinMatch(game, player);
    case "playAutomatically":
      return playAutomatically(game, player, events, random);
    case "playMovementOnly":
      return playMovementOnly(game, player, events, random);
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
  const goingOut = { goingOut: player.hand.length - cards.length <= 1, wild: wildOf(game) };
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
  const created = createMeld(cards, { goingOut: player.hand.length - cards.length <= 1, wild: wildOf(game) });
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
  const extended = addToMeld(target, cards, { goingOut: player.hand.length - cards.length <= 1, wild: wildOf(game) });
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
  const swap = cards.length === 1 ? replaceJoker(game.melds[meldIndex], cards[0], { wild: wildOf(game) }) : undefined;
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
  const goingOut = { goingOut: player.hand.length - cards.length - extraCards.length <= 1, wild: wildOf(game) };
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
  if (isJoker(card, wildOf(game))) {
    return "jokerCannotBeDiscarded";
  }
  if (!canDiscard(card, game.melds, { wild: wildOf(game) })) {
    return "cardFitsTable";
  }
  discardCard(game, player, card, events);
  return undefined;
}

function goOut(game: Game, player: GamePlayer, events: GameEvent[]) {
  const top = game.discard.at(-1);
  if (!isPlaying(player) || !top || game.phase !== "playing") {
    return "notAllowed";
  }
  if (!canGoOutWithDiscard(game, player.id)) {
    return "notYourTurnToGoOut";
  }
  if (player.bluffed) {
    return "alreadyBluffed";
  }

  const found = findGoOut([...player.hand, top], game.melds, { mustUse: top, wild: wildOf(game) });
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

export function returnPoints(players: readonly Pick<GamePlayer, "points" | "eliminated" | "awaitingReturn">[]) {
  const staying = players.filter((candidate) => !candidate.eliminated && !candidate.awaitingReturn);
  return Math.max(...staying.map((candidate) => candidate.points));
}

function chooseReturn(game: Game, player: GamePlayer, back: boolean, events: GameEvent[]) {
  if (game.phase !== "roundOver" || !player.awaitingReturn) {
    return "notAllowed";
  }
  if (!back) {
    player.awaitingReturn = false;
    player.eliminated = true;
    events.push({ type: "eliminated", playerId: player.id });
    endMatchWhenNobodyIsLeftToPlay(game, events);
    return undefined;
  }
  player.points = returnPoints(game.players);
  player.awaitingReturn = false;
  events.push({ type: "returned", playerId: player.id, points: player.points });
  endMatchWhenNobodyIsLeftToPlay(game, events);
  return undefined;
}

function leaveMatch(game: Game, player: GamePlayer, events: GameEvent[]) {
  if (game.phase === "ended" || player.eliminated) {
    return "notAllowed";
  }
  player.leftMatch = true;
  if (player.awaitingReturn) {
    return chooseReturn(game, player, true, events);
  }
  endMatchWhenNobodyIsLeftToPlay(game, events);
  return undefined;
}

function rejoinMatch(game: Game, player: GamePlayer) {
  if (game.phase === "ended" || player.eliminated) {
    return "notAllowed";
  }
  player.leftMatch = false;
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

  discardAtRandom(game, player, events, random);
  return undefined;
}

function playMovementOnly(game: Game, player: GamePlayer, events: GameEvent[], random: Random) {
  if (!isTurnOf(game, player)) {
    return "notAllowed";
  }
  if (!game.hasDrawn) {
    drawCard(game, player, events, random);
  }
  if (game.phase !== "playing") {
    return undefined;
  }

  discardAtRandom(game, player, events, random);
  return undefined;
}

function discardAtRandom(game: Game, player: GamePlayer, events: GameEvent[], random: Random) {
  const discardable = player.hand.filter((card) => canDiscard(card, game.melds, { wild: wildOf(game) }));
  if (discardable.length === 0) {
    game.hasDrawn = false;
    game.discardIsFree = false;
    passTurn(game, events);
    return;
  }
  discardCard(game, player, discardable[Math.floor(random() * discardable.length)], events);
}

function meldEverythingPossible(game: Game, player: GamePlayer, events: GameEvent[]) {
  const wild = wildOf(game);
  for (let cards = findMeldInHand(player.hand, { wild }); cards; cards = findMeldInHand(player.hand, { wild })) {
    const created = createMeld(cards, { goingOut: player.hand.length - cards.length <= 1, wild });
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
    const goingOut = { goingOut: player.hand.length <= 2, wild: wildOf(game) };
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
    endRound(game, winnerWithoutCards(game), events, "outOfCards");
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

function endRound(game: Game, winner: GamePlayer, events: GameEvent[], reason: RoundEndReason = "goOut") {
  for (const player of game.players) {
    if (player === winner || player.eliminated) {
      continue;
    }
    player.roundPoints = handPoints(player.hand, wildOf(game));
    player.points += player.roundPoints;
  }
  game.wentOut = winner.id;
  game.phase = "roundOver";
  events.push({ type: "roundEnded", wentOut: winner.id, reason });

  const active = game.players.filter((player) => !player.eliminated);
  const passed = active.filter((player) => player.points > ELIMINATION_POINTS);
  const staying = active.filter((player) => player.points <= ELIMINATION_POINTS);
  if (staying.length <= 1) {
    for (const player of passed) {
      player.eliminated = true;
    }
    game.winner = staying[0]?.id ?? "";
    game.phase = "ended";
    events.push({ type: "matchEnded", winner: game.winner, reason: winsByPlaying(staying[0]) ? "points" : "walkover" });
    return;
  }
  if (passed.length > 0) {
    for (const player of passed) {
      player.awaitingReturn = true;
    }
    events.push({ type: "returnOffered", playerIds: passed.map((player) => player.id) });
  }
  game.dealer = nextActive(game, game.dealer);
  endMatchWhenNobodyIsLeftToPlay(game, events);
}

function winsByPlaying(winner: GamePlayer | undefined) {
  return winner !== undefined && isPlaying(winner) && willPlay(winner);
}

function endMatchWhenNobodyIsLeftToPlay(game: Game, events: GameEvent[]) {
  if (game.phase !== "roundOver" || game.players.some((player) => player.awaitingReturn)) {
    return;
  }
  const playing = game.players.filter(willPlay);
  if (playing.length >= MIN_PLAYERS_TO_CONTINUE) {
    return;
  }
  game.winner = playing[0]?.id ?? "";
  game.phase = "ended";
  events.push({ type: "matchEnded", winner: game.winner, reason: "walkover" });
}

function winnerWithoutCards(game: Game) {
  const dealerSeat = game.players.findIndex((player) => player.id === game.dealer);
  const fromDealer = [...game.players.slice(dealerSeat + 1), ...game.players.slice(0, dealerSeat + 1)];
  const active = fromDealer.filter(isPlaying);
  const wild = wildOf(game);
  return active.sort((a, b) => a.points - b.points || handPoints(a.hand, wild) - handPoints(b.hand, wild))[0];
}

function passTurn(game: Game, events: GameEvent[]) {
  game.currentTurn = nextActive(game, game.currentTurn);
  events.push({ type: "turnStarted", playerId: game.currentTurn });
}

function nextActive(game: Game, playerId: string) {
  const seat = game.players.findIndex((player) => player.id === playerId);
  for (let step = 1; step <= game.players.length; step++) {
    const candidate = game.players[(seat + step) % game.players.length];
    if (isPlaying(candidate)) {
      return candidate.id;
    }
  }
  return playerId;
}

function wildOf(game: Game) {
  return game.flipped && lifeJokerFor(game.flipped);
}

function isPlaying(player: GamePlayer) {
  return !player.eliminated && !player.sittingOut;
}

function willPlay(player: GamePlayer) {
  return !player.eliminated && !player.leftMatch;
}

function isTurnOf(game: Game, player: GamePlayer) {
  return game.phase === "playing" && game.currentTurn === player.id;
}

export type DiscardTurn = { discardIsFree: boolean; currentTurn: string; lastDiscarder: string };

export function canGoOutWithDiscard(turn: DiscardTurn, playerId: string) {
  return turn.discardIsFree && playerId !== turn.currentTurn && playerId !== turn.lastDiscarder;
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
