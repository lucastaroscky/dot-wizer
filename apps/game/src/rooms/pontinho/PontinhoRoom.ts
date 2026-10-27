import { Room, Delayed, validate, type Client as ColyseusClient } from "colyseus";
import { StateView } from "@colyseus/schema";
import { abandonMatch, applyAction, startMatch, startRound, type Action, type Game, type GameError, type GameEvent } from "@pontinho/rules";
import {
  createOptionsSchema,
  discardMessageSchema,
  joinOptionsSchema,
  layOffMessageSchema,
  MAX_PLAYERS,
  meldMessageSchema,
  Player,
  PontinhoState,
  takeDiscardMessageSchema,
  type Announcement,
  type ClientMessages,
  type ServerMessages,
} from "@pontinho/protocol";
import { mirrorGame } from "./mirrorGame.js";

const RECONNECTION_SECONDS = 120;
const NEXT_ROUND_DELAY_MS = 8_000;
const BLUFF_MESSAGE_MS = 5_000;
const TURN_MS = 30_000;
const BOT_DELAY_MS = 3_000;
const MAX_MESSAGES_PER_SECOND = 10;

type Client = ColyseusClient<{ messages: ServerMessages }>;

export class PontinhoRoom extends Room<{ state: PontinhoState; client: Client }> {
  maxClients = MAX_PLAYERS;
  maxMessagesPerSecond = MAX_MESSAGES_PER_SECOND;
  state = new PontinhoState();

  private game?: Game;
  private turnTimer?: Delayed;
  private nextRoundTimer?: Delayed;
  private withBots = false;

  messages = {
    draw: (client: Client) => this.act(client, { type: "draw" }),
    takeDiscard: validate(takeDiscardMessageSchema, (client: Client, message) => this.act(client, { type: "takeDiscard", ...message })),
    meld: validate(meldMessageSchema, (client: Client, message) => this.act(client, { type: "meld", ...message })),
    layOff: validate(layOffMessageSchema, (client: Client, message) => this.act(client, { type: "layOff", ...message })),
    discard: validate(discardMessageSchema, (client: Client, cardId) => this.act(client, { type: "discard", cardId })),
    goOut: (client: Client) => this.act(client, { type: "goOut" }),
  } satisfies Record<keyof ClientMessages, unknown>;

  onCreate(options: unknown) {
    const { seats, bots } = createOptionsSchema.parse(options);
    this.withBots = bots;
    this.maxClients = bots ? 1 : seats;
    this.state.seats = seats;
  }

  onUncaughtException(error: Error, methodName: string) {
    console.error(`Erro na sala ${this.roomId} em ${methodName}:`, error);
  }

  onJoin(client: Client, options: unknown) {
    const { name } = joinOptionsSchema.parse(options);
    this.addPlayer(client.sessionId, name, false);

    client.view = new StateView();
    const player = this.state.players.get(client.sessionId);
    if (player) {
      client.view.add(player);
      client.view.subscribe(player.hand);
    }

    if (this.withBots) {
      this.addBots();
    }
    if (this.state.players.size >= this.state.seats) {
      this.startMatch();
    }
  }

  onDrop(client: Client) {
    if (this.state.phase === "waiting") {
      return;
    }
    this.allowReconnection(client, RECONNECTION_SECONDS).catch(() => {});
  }

  onLeave(client: Client) {
    if (!this.game) {
      this.removePlayer(client.sessionId);
      return;
    }
    const player = this.game.players.find((candidate) => candidate.id === client.sessionId);
    if (!player || player.eliminated || this.game.phase === "ended") {
      return;
    }
    this.turnTimer?.clear();
    this.nextRoundTimer?.clear();
    this.game = abandonMatch(this.game);
    mirrorGame(this.state, this.game);
    this.announce("playerLeft");
  }

  private act(client: Client, action: Action) {
    const error = this.apply(client.sessionId, action);
    if (!error || error === "notAllowed") {
      return;
    }
    client.send("invalid", error);
  }

  private apply(playerId: string, action: Action): GameError | undefined {
    if (!this.game) {
      return "notAllowed";
    }
    const result = applyAction(this.game, playerId, action);
    if ("error" in result) {
      return result.error;
    }
    this.game = result.game;
    mirrorGame(this.state, this.game);
    result.events.forEach((event) => this.handle(event));
    return undefined;
  }

  private handle(event: GameEvent) {
    switch (event.type) {
      case "move":
        this.broadcast("move", { kind: event.kind, playerId: event.playerId, cardIds: event.cardIds });
        return;
      case "turnStarted":
        this.startTurnTimer();
        return;
      case "bluffed":
        this.announceBriefly("bluffed", event.playerId);
        return;
      case "roundEnded":
        this.endRound(event.wentOut);
        return;
      case "matchEnded":
        this.announce("won", event.winner);
        return;
    }
  }

  private startMatch() {
    this.lock();
    this.showRound(startMatch(this.state.order.toArray()));
  }

  private beginRound() {
    if (this.game?.phase !== "roundOver") {
      return;
    }
    this.showRound(startRound(this.game));
  }

  private showRound(game: Game) {
    this.game = game;
    mirrorGame(this.state, game);
    this.announce("");
    this.startTurnTimer();
  }

  private endRound(wentOut: string) {
    this.turnTimer?.clear();
    this.state.turnDuration = 0;
    this.announce(wentOut ? "wentOut" : "outOfCards", wentOut);
    if (this.game?.phase !== "roundOver") {
      return;
    }
    this.nextRoundTimer = this.clock.setTimeout(() => this.beginRound(), NEXT_ROUND_DELAY_MS);
  }

  private startTurnTimer() {
    this.turnTimer?.clear();
    const delay = this.state.players.get(this.state.currentTurn)?.bot ? BOT_DELAY_MS : TURN_MS;
    this.state.turnNumber++;
    this.state.turnDuration = delay;
    this.turnTimer = this.clock.setTimeout(() => this.apply(this.game?.currentTurn ?? "", { type: "playAutomatically" }), delay);
  }

  private announce(announcement: Announcement | "", playerId = "") {
    this.state.announcement = announcement;
    this.state.announcementPlayer = playerId;
  }

  private announceBriefly(announcement: Announcement, playerId: string) {
    this.announce(announcement, playerId);
    this.clock.setTimeout(() => {
      if (this.state.announcement === announcement && this.state.announcementPlayer === playerId) {
        this.announce("");
      }
    }, BLUFF_MESSAGE_MS);
  }

  private addPlayer(id: string, name: string, bot: boolean) {
    const player = new Player();
    player.name = name;
    player.bot = bot;
    this.state.players.set(id, player);
    this.state.order.push(id);
  }

  private removePlayer(id: string) {
    this.state.players.delete(id);
    const seat = this.state.order.indexOf(id);
    if (seat !== -1) {
      this.state.order.splice(seat, 1);
    }
  }

  private addBots() {
    for (let number = 1; this.state.order.length < this.state.seats; number++) {
      this.addPlayer(`bot-${number}`, `Robô ${number}`, true);
    }
  }

}
