import { Room, Delayed, validate, type Client as ColyseusClient } from "colyseus";
import { z } from "zod";
import { StateView } from "@colyseus/schema";
import {
  addToMeld,
  canDiscard,
  createDeck,
  createMeld,
  dealRound,
  drawFromStock,
  ELIMINATION_POINTS,
  findGoOut,
  findMeldInHand,
  handPoints,
  replaceJoker,
  type Card,
  type Meld,
  type MeldKind,
} from "@pontinho/rules";
import errors from "../common/messages/errors.json" with { type: "json" };
import announcements from "../common/messages/announcements.json" with { type: "json" };
import { CardState, MeldState, Player, PontinhoState } from "./schema/PontinhoState.js";

const RECONNECTION_SECONDS = 120;
const MIN_PLAYERS = 3;
const MAX_PLAYERS = 6;
const NEXT_ROUND_DELAY_MS = 8_000;
const BLUFF_MESSAGE_MS = 5_000;
const TURN_MS = 30_000;
const BOT_DELAY_MS = 3_000;
const MAX_MESSAGES_PER_SECOND = 10;
const MAX_CARDS_PER_ACTION = 14;
const MAX_NAME_LENGTH = 20;

const DECK = createDeck();
const CARDS_BY_ID = new Map(DECK.map((card) => [card.id, card]));

const cardIdSchema = z.enum(DECK.map((card) => card.id) as [string, ...string[]]);
const cardIdsSchema = z.array(cardIdSchema).max(MAX_CARDS_PER_ACTION);
const meldIndexSchema = z.number().int().min(0);
const meldSchema = z.object({ cardIds: cardIdsSchema });
const takeDiscardSchema = z.object({ cardIds: cardIdsSchema, meldIndex: meldIndexSchema.optional() });
const layOffSchema = z.object({
  cardIds: cardIdsSchema,
  meldIndex: meldIndexSchema,
  jokerTo: z.object({ meldIndex: meldIndexSchema.optional(), cardIds: cardIdsSchema }).optional(),
});
const joinSchema = z.object({ name: z.string().trim().min(1).max(MAX_NAME_LENGTH) });
const createSchema = z.object({ seats: z.number().int().min(MIN_PLAYERS).max(MAX_PLAYERS), bots: z.boolean() });
export type MoveEvent = { kind: "draw" | "toTable" | "discard"; playerId: string; cardIds: string[] };

type Client = ColyseusClient<{ messages: { invalid: string; move: MoveEvent } }>;

function toCardState(card: Card) {
  const cardState = new CardState();
  cardState.id = card.id;
  cardState.rank = card.rank;
  if (card.rank !== "JOKER") {
    cardState.suit = card.suit;
  }
  return cardState;
}

function toMeldState(meld: Meld) {
  const meldState = new MeldState();
  meldState.kind = meld.kind;
  meldState.cards.push(...meld.cards.map(toCardState));
  return meldState;
}

function toMeld(meldState: MeldState): Meld {
  return { kind: meldState.kind as MeldKind, cards: meldState.cards.map((card) => CARDS_BY_ID.get(card.id)!) };
}

export class PontinhoRoom extends Room<{ state: PontinhoState; client: Client }> {
  maxClients = MAX_PLAYERS;
  maxMessagesPerSecond = MAX_MESSAGES_PER_SECOND;
  state = new PontinhoState();

  private stock: Card[] = [];
  private discard: Card[] = [];
  private turnTimer?: Delayed;
  private nextRoundTimer?: Delayed;
  private dealerSeat = 0;
  private withBots = false;

  messages = {
    draw: (client: Client) => {
      const player = this.state.players.get(client.sessionId);
      if (!player || !this.isTurnOf(client) || this.state.hasDrawn) {
        return;
      }
      this.drawFor(client.sessionId, player);
    },

    takeDiscard: validate(takeDiscardSchema, (client: Client, message) => {
      const player = this.state.players.get(client.sessionId);
      const cards = message.cardIds.length === 0 ? [] : this.cardsInHand(player, message.cardIds);
      const top = this.discard[this.discard.length - 1];
      if (!player || !cards || !top || !this.isTurnOf(client) || this.state.hasDrawn) {
        return;
      }
      if (player.hand.length === 1) {
        client.send("invalid", errors.discardWithOneCard);
        return;
      }
      const target = message.meldIndex === undefined ? undefined : this.state.melds[message.meldIndex];
      const goingOut = { goingOut: player.hand.length - cards.length <= 1 };
      const meld = target ? addToMeld(toMeld(target), [top, ...cards], goingOut) : createMeld([top, ...cards], goingOut);
      if (!meld) {
        client.send("invalid", errors.discardNeedsMeld);
        return;
      }

      this.discard = this.discard.slice(0, -1);
      this.removeFromHand(player, cards);
      this.placeMeld(meld, message.meldIndex);
      this.announceMove("toTable", client.sessionId, [top, ...cards]);
      this.state.hasDrawn = true;
      this.state.discardIsFree = false;
      this.syncPiles();
      this.endRoundIfEmpty(client.sessionId, player);
    }),

    meld: validate(meldSchema, (client: Client, message) => {
      const player = this.state.players.get(client.sessionId);
      const cards = this.cardsInHand(player, message.cardIds);
      if (!player || !cards || !this.isTurnOf(client) || !this.state.hasDrawn) {
        return;
      }
      const meld = createMeld(cards, { goingOut: player.hand.length - cards.length <= 1 });
      if (!meld) {
        client.send("invalid", errors.invalidMeld);
        return;
      }
      this.removeFromHand(player, cards);
      this.placeMeld(meld);
      this.announceMove("toTable", client.sessionId, cards);
      this.endRoundIfEmpty(client.sessionId, player);
    }),

    layOff: validate(layOffSchema, (client: Client, message) => {
      const player = this.state.players.get(client.sessionId);
      const cards = this.cardsInHand(player, message.cardIds);
      const target = this.state.melds[message.meldIndex];
      if (!player || !cards || !target || !this.isTurnOf(client) || !this.state.hasDrawn) {
        return;
      }
      const meld = addToMeld(toMeld(target), cards, { goingOut: player.hand.length - cards.length <= 1 });
      if (meld) {
        this.removeFromHand(player, cards);
        this.placeMeld(meld, message.meldIndex);
        this.announceMove("toTable", client.sessionId, cards);
        this.endRoundIfEmpty(client.sessionId, player);
        return;
      }

      const swap = cards.length === 1 ? replaceJoker(toMeld(target), cards[0]) : undefined;
      if (!swap) {
        client.send("invalid", errors.invalidLayOff);
        return;
      }
      if (!message.jokerTo) {
        client.send("invalid", errors.jokerNeedsPlace);
        return;
      }
      const extraCards = message.jokerTo.cardIds.length === 0 ? [] : this.cardsInHand(player, message.jokerTo.cardIds);
      if (!extraCards || extraCards.some((card) => card.id === cards[0].id)) {
        return;
      }

      const table = this.state.melds.map(toMeld);
      table[message.meldIndex] = swap.meld;
      const jokerTarget = message.jokerTo.meldIndex === undefined ? undefined : table[message.jokerTo.meldIndex];
      const goingOut = { goingOut: player.hand.length - cards.length - extraCards.length <= 1 };
      const jokerMeld = jokerTarget
        ? addToMeld(jokerTarget, [swap.joker, ...extraCards], goingOut)
        : createMeld([swap.joker, ...extraCards], goingOut);
      if (!jokerMeld) {
        client.send("invalid", errors.jokerPlacement);
        return;
      }

      this.removeFromHand(player, [...cards, ...extraCards]);
      this.placeMeld(swap.meld, message.meldIndex);
      this.placeMeld(jokerMeld, jokerTarget ? message.jokerTo.meldIndex : undefined);
      this.announceMove("toTable", client.sessionId, [...cards, ...extraCards]);
      this.endRoundIfEmpty(client.sessionId, player);
    }),

    discard: validate(cardIdSchema, (client: Client, cardId) => {
      const player = this.state.players.get(client.sessionId);
      const cards = this.cardsInHand(player, [cardId]);
      if (!player || !cards || !this.isTurnOf(client) || !this.state.hasDrawn) {
        return;
      }
      if (!canDiscard(cards[0], this.state.melds.map(toMeld))) {
        const reason = cards[0].rank === "JOKER" ? errors.jokerCannotBeDiscarded : errors.cardFitsTable;
        client.send("invalid", reason);
        return;
      }
      this.discardFor(client.sessionId, player, cards[0]);
    }),

    goOut: (client: Client) => {
      const player = this.state.players.get(client.sessionId);
      const top = this.discard[this.discard.length - 1];
      if (!player || player.eliminated || !top || this.state.phase !== "playing") {
        return;
      }
      if (!this.canGoOutWithDiscard(client.sessionId)) {
        client.send("invalid", errors.notYourTurnToGoOut);
        return;
      }
      if (player.bluffed) {
        client.send("invalid", errors.alreadyBluffed);
        return;
      }

      const hand = player.hand.map((card) => CARDS_BY_ID.get(card.id)!);
      const goOut = findGoOut([...hand, top], this.state.melds.map(toMeld), top);
      if (!goOut) {
        player.bluffed = true;
        const message = announcements.bluffed.replace("{name}", player.name);
        this.state.announcement = message;
        this.clock.setTimeout(() => {
          if (this.state.announcement === message) {
            this.state.announcement = "";
          }
        }, BLUFF_MESSAGE_MS);
        return;
      }

      this.discard = goOut.discard ? [...this.discard.slice(0, -1), goOut.discard] : this.discard.slice(0, -1);
      this.removeFromHand(player, hand);
      this.announceMove("toTable", client.sessionId, hand);
      this.state.melds.clear();
      this.state.melds.push(...goOut.table.map(toMeldState));
      this.syncPiles();
      this.endRound(client.sessionId);
    },
  };

  onCreate(options: unknown) {
    const { seats, bots } = createSchema.parse(options);
    this.withBots = bots;
    this.maxClients = bots ? 1 : seats;
    this.state.seats = seats;
  }

  onUncaughtException(error: Error, methodName: string) {
    console.error(`Erro na sala ${this.roomId} em ${methodName}:`, error);
  }

  onJoin(client: Client, options: unknown) {
    const { name } = joinSchema.parse(options);
    const player = new Player();
    player.name = name;
    this.state.players.set(client.sessionId, player);
    this.state.order.push(client.sessionId);

    client.view = new StateView();
    client.view.add(player);
    client.view.subscribe(player.hand);

    if (this.withBots) {
      this.addBots();
    }
    this.scheduleStart();
  }

  onDrop(client: Client) {
    if (this.state.phase === "waiting") {
      return;
    }
    this.allowReconnection(client, RECONNECTION_SECONDS).catch(() => {});
  }

  onLeave(client: Client) {
    const player = this.state.players.get(client.sessionId);
    if (!player || player.eliminated || this.state.phase === "ended") {
      return;
    }
    if (this.state.phase === "playing" || this.state.phase === "roundOver") {
      this.turnTimer?.clear();
      this.nextRoundTimer?.clear();
      this.state.phase = "ended";
      this.state.announcement = announcements.playerLeft;
      return;
    }

    this.state.players.delete(client.sessionId);
    const seat = this.state.order.indexOf(client.sessionId);
    if (seat !== -1) {
      this.state.order.splice(seat, 1);
    }

  }

  private scheduleStart() {
    if (this.state.phase !== "waiting" || this.state.players.size < this.state.seats) {
      return;
    }
    this.startMatch();
  }

  private startMatch() {
    this.lock();
    this.startRound();
  }

  private startRound() {
    if (this.state.phase === "ended") {
      return;
    }
    const seats = this.activeSeats();
    const round = dealRound(seats.length);

    this.state.melds.clear();
    this.state.wentOut = "";
    this.state.players.forEach((player) => {
      player.hand.clear();
      player.cardCount = 0;
      player.roundPoints = 0;
      player.bluffed = false;
    });
    seats.forEach((sessionId, seat) => {
      const player = this.state.players.get(sessionId);
      if (!player) {
        return;
      }
      this.giveCards(player, round.hands[seat]);
    });

    this.stock = round.stock;
    this.discard = round.discard;
    this.state.currentTurn = this.nextActive(this.state.order[this.dealerSeat]);
    this.state.hasDrawn = false;
    this.state.discardIsFree = false;
    this.state.lastDiscarder = "";
    this.state.announcement = "";
    this.state.phase = "playing";
    this.syncPiles();
    this.startTurnTimer();
  }

  private endRound(winnerId: string) {
    this.turnTimer?.clear();
    this.state.turnDeadline = 0;
    this.state.players.forEach((player, sessionId) => {
      if (sessionId === winnerId || player.eliminated) {
        return;
      }
      player.roundPoints = handPoints(player.hand.map((card) => CARDS_BY_ID.get(card.id)!));
      this.addPoints(player, player.roundPoints);
    });
    this.state.wentOut = winnerId;

    const winnerName = this.state.players.get(winnerId)?.name ?? "";
    this.state.announcement = announcements.wentOut.replace("{name}", winnerName);
    this.state.phase = "roundOver";

    const remaining = this.activeSeats();
    if (remaining.length <= 1) {
      this.state.winner = remaining[0] ?? "";
      this.state.announcement = announcements.won.replace("{name}", this.state.players.get(remaining[0])?.name ?? "");
      this.state.phase = "ended";
      return;
    }

    this.scheduleNextRound();
  }

  private endRoundWithoutCards() {
    this.turnTimer?.clear();
    this.state.turnDeadline = 0;
    this.state.announcement = announcements.outOfCards;
    this.state.phase = "roundOver";
    this.scheduleNextRound();
  }

  private scheduleNextRound() {
    this.dealerSeat = this.state.order.indexOf(this.nextActive(this.state.order[this.dealerSeat]));
    this.nextRoundTimer = this.clock.setTimeout(() => this.startRound(), NEXT_ROUND_DELAY_MS);
  }

  private endRoundIfEmpty(sessionId: string, player: Player) {
    if (player.hand.length === 0) {
      this.endRound(sessionId);
    }
  }

  private addPoints(player: Player, points: number) {
    player.points += points;
    if (player.points > ELIMINATION_POINTS) {
      player.eliminated = true;
    }
  }

  private activeSeats() {
    return this.state.order.filter((sessionId) => !this.state.players.get(sessionId)?.eliminated);
  }

  private nextActive(sessionId: string) {
    const seat = this.state.order.indexOf(sessionId);
    for (let step = 1; step <= this.state.order.length; step++) {
      const candidate = this.state.order[(seat + step) % this.state.order.length];
      if (!this.state.players.get(candidate)?.eliminated) {
        return candidate;
      }
    }
    return sessionId;
  }

  private announceMove(kind: MoveEvent["kind"], playerId: string, cards: Card[]) {
    const event: MoveEvent = { kind, playerId, cardIds: cards.map((card) => card.id) };
    this.broadcast("move", event);
  }

  private drawFor(sessionId: string, player: Player) {
    const result = drawFromStock({ stock: this.stock, discard: this.discard });
    if (!result) {
      this.endRoundWithoutCards();
      return;
    }
    this.stock = result.stock;
    this.discard = result.discard;

    this.giveCards(player, [result.card]);
    this.state.hasDrawn = true;
    this.state.discardIsFree = true;
    this.syncPiles();
    this.announceMove("draw", sessionId, []);
  }

  private discardFor(sessionId: string, player: Player, card: Card) {
    this.removeFromHand(player, [card]);
    this.discard.push(card);
    this.syncPiles();
    this.announceMove("discard", sessionId, [card]);
    if (player.hand.length === 0) {
      this.endRound(sessionId);
      return;
    }
    this.state.hasDrawn = false;
    this.state.discardIsFree = false;
    this.state.lastDiscarder = sessionId;
    this.passTurn();
    this.startTurnTimer();
  }

  private addBots() {
    for (let number = 1; this.state.order.length < this.state.seats; number++) {
      const bot = new Player();
      bot.name = `Robô ${number}`;
      bot.bot = true;
      this.state.players.set(`bot-${number}`, bot);
      this.state.order.push(`bot-${number}`);
    }
  }

  private startTurnTimer() {
    this.turnTimer?.clear();
    const delay = this.state.players.get(this.state.currentTurn)?.bot ? BOT_DELAY_MS : TURN_MS;
    this.state.turnDeadline = Date.now() + TURN_MS;
    this.turnTimer = this.clock.setTimeout(() => this.playAutomatically(), delay);
  }

  private playAutomatically() {
    const sessionId = this.state.currentTurn;
    const player = this.state.players.get(sessionId);
    if (!player || this.state.phase !== "playing") {
      return;
    }
    if (!this.state.hasDrawn) {
      this.drawFor(sessionId, player);
    }
    if (this.state.phase !== "playing") {
      return;
    }

    this.meldEverythingPossible(sessionId, player);
    this.layOffEverythingThatFits(sessionId, player);
    if (player.hand.length === 0) {
      this.endRound(sessionId);
      return;
    }

    const table = this.state.melds.map(toMeld);
    const discardable = this.handOf(player).filter((card) => canDiscard(card, table));
    if (discardable.length === 0) {
      this.state.hasDrawn = false;
      this.state.discardIsFree = false;
      this.passTurn();
      this.startTurnTimer();
      return;
    }
    this.discardFor(sessionId, player, discardable[Math.floor(Math.random() * discardable.length)]);
  }

  private meldEverythingPossible(sessionId: string, player: Player) {
    for (let cards = findMeldInHand(this.handOf(player)); cards; cards = findMeldInHand(this.handOf(player))) {
      const meld = createMeld(cards, { goingOut: player.hand.length - cards.length <= 1 });
      if (!meld) {
        return;
      }
      this.removeFromHand(player, cards);
      this.placeMeld(meld);
      this.announceMove("toTable", sessionId, cards);
    }
  }

  private layOffEverythingThatFits(sessionId: string, player: Player) {
    for (const card of this.handOf(player)) {
      const goingOut = { goingOut: player.hand.length <= 2 };
      const meldIndex = this.state.melds.findIndex((meld) => addToMeld(toMeld(meld), [card], goingOut));
      if (meldIndex === -1) {
        continue;
      }
      const meld = addToMeld(toMeld(this.state.melds[meldIndex]), [card], goingOut);
      if (!meld) {
        continue;
      }
      this.removeFromHand(player, [card]);
      this.placeMeld(meld, meldIndex);
      this.announceMove("toTable", sessionId, [card]);
    }
  }

  private handOf(player: Player) {
    return player.hand.map((card) => CARDS_BY_ID.get(card.id)!);
  }

  private isTurnOf(client: Client) {
    return this.state.phase === "playing" && this.state.currentTurn === client.sessionId;
  }

  private canGoOutWithDiscard(sessionId: string) {
    return this.state.discardIsFree && sessionId !== this.state.currentTurn && sessionId !== this.state.lastDiscarder;
  }

  private cardsInHand(player: Player | undefined, cardIds: string[]) {
    const uniqueIds = new Set(cardIds);
    const inHand = player?.hand.filter((card) => uniqueIds.has(card.id)) ?? [];
    if (inHand.length === 0 || inHand.length !== cardIds.length) {
      return undefined;
    }
    return cardIds.map((id) => CARDS_BY_ID.get(id)!);
  }

  private giveCards(player: Player, cards: Card[]) {
    player.hand.push(...cards.map(toCardState));
    player.cardCount = player.hand.length;
  }

  private removeFromHand(player: Player, cards: Card[]) {
    for (const card of cards) {
      player.hand.splice(player.hand.findIndex((cardState) => cardState.id === card.id), 1);
    }
    player.cardCount = player.hand.length;
  }

  private placeMeld(meld: Meld, meldIndex?: number) {
    if (meldIndex === undefined) {
      this.state.melds.push(toMeldState(meld));
      return;
    }
    this.state.melds.splice(meldIndex, 1, toMeldState(meld));
  }

  private passTurn() {
    this.state.currentTurn = this.nextActive(this.state.currentTurn);
  }

  private syncPiles() {
    this.state.stockCount = this.stock.length;
    const top = this.discard[this.discard.length - 1];
    this.state.discardTop = top ? toCardState(top) : undefined;
  }
}
