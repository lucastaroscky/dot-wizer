import { CloseCode, Deferred, Room, Delayed, ServerError, definePlugins, validate, type Client as ColyseusClient } from "colyseus";
import { UniqueSessionPlugin } from "colyseus/plugins/unique-session";
import { StateView } from "@colyseus/schema";
import { abandonMatch, applyAction, startMatch, startRound, type Action, type Game, type GameError, type GameEvent } from "@pontinho/rules";
import {
  CLOSE_CODES,
  chooseReturnMessageSchema,
  createOptionsSchema,
  discardMessageSchema,
  JOIN_REFUSALS,
  layOffMessageSchema,
  MAX_PLAYERS,
  meldMessageSchema,
  MIN_PLAYERS,
  Player,
  PontinhoState,
  PRACTICE_TABLE,
  takeDiscardMessageSchema,
  type Announcement,
  type ClientMessages,
  type Connection,
  type ServerMessages,
} from "@pontinho/protocol";
import { describeFailure, type GameApi } from "../../gameApi/GameApi.js";
import { ChipsMatch, NO_WINNER, type ChipsFinance, type MatchResult } from "./ChipsMatch.js";
import { mirrorGame } from "./mirrorGame.js";
import { openMatches } from "./openMatches.js";
import { createPlayerAuthenticator, refuse, type PlayerAuth } from "./playerAuth.js";

const RECONNECTION_MS = 120_000;
const NEXT_ROUND_DELAY_MS = 8_000;
const BLUFF_MESSAGE_MS = 5_000;
const TURN_MS = 30_000;
const RETURN_MS = 15_000;
const COUNTDOWN_MS = 10_000;
const AUTOMATIC_TURN_MS = 3_000;
const MAX_MESSAGES_PER_SECOND = 10;

type Client = ColyseusClient<{ messages: ServerMessages; auth: PlayerAuth }>;
type Reservation = ReturnType<PontinhoRoom["allowReconnection"]>;

export function createPontinhoRoom(gameApi: GameApi) {
  return class extends PontinhoRoom {
    static onAuth = createPlayerAuthenticator(gameApi);
    protected gameApi = gameApi;
  };
}

export abstract class PontinhoRoom extends Room<{ state: PontinhoState; client: Client }> {
  protected abstract gameApi: GameApi;
  plugins = definePlugins({
    uniqueSession: new UniqueSessionPlugin({
      max: 1,
      rejectCode: JOIN_REFUSALS.alreadyInRoom.code,
      rejectMessage: JOIN_REFUSALS.alreadyInRoom.message,
    }),
  });
  maxClients = MAX_PLAYERS;
  maxMessagesPerSecond = MAX_MESSAGES_PER_SECOND;
  state = new PontinhoState();

  private game?: Game;
  private turnTimer?: Delayed;
  private nextRoundTimer?: Delayed;
  private returnTimer?: Delayed;
  private countdownTimer?: Delayed;
  private withBots = false;
  private chips?: ChipsMatch;
  private breakElapsed = false;
  private registering = false;
  private aborted = false;
  private winnerToShow = "";
  private userIds = new Map<string, string>();
  private reservations = new Map<string, Reservation>();

  messages = {
    draw: (client: Client) => this.act(client, { type: "draw" }),
    takeDiscard: validate(takeDiscardMessageSchema, (client: Client, message) => this.act(client, { type: "takeDiscard", ...message })),
    meld: validate(meldMessageSchema, (client: Client, message) => this.act(client, { type: "meld", ...message })),
    layOff: validate(layOffMessageSchema, (client: Client, message) => this.act(client, { type: "layOff", ...message })),
    discard: validate(discardMessageSchema, (client: Client, cardId) => this.act(client, { type: "discard", cardId })),
    goOut: (client: Client) => this.act(client, { type: "goOut" }),
    chooseReturn: validate(chooseReturnMessageSchema, (client: Client, { back }) => this.act(client, { type: "chooseReturn", back })),
  } satisfies Record<keyof ClientMessages, unknown>;

  onCreate(options: unknown) {
    const parsed = createOptionsSchema.parse(options);
    this.withBots = parsed.bots;
    this.maxClients = parsed.bots ? 1 : MAX_PLAYERS;
    this.state.seats = parsed.bots ? parsed.seats : MAX_PLAYERS;
    this.state.table = parsed.bots ? PRACTICE_TABLE : parsed.table;
  }

  onUncaughtException(error: Error, methodName: string) {
    if (error.cause instanceof ServerError) {
      return;
    }
    console.error(`Erro na sala ${this.roomId} em ${methodName}:`, error);
  }

  onJoin(client: Client, _options: unknown, auth: PlayerAuth) {
    if (auth.table !== this.state.table) {
      throw refuse("invalidOptions");
    }
    this.addPlayer(client.sessionId, auth.name, auth.photoUrl, false);
    this.userIds.set(client.sessionId, auth.id);

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
      return;
    }
    this.startCountdownWhenEnoughSeated();
  }

  async onDispose() {
    await this.finishChips(NO_WINNER);
    await this.closeOpenMatch();
  }

  onBeforeShutdown() {
    this.stopMatch();
    super.onBeforeShutdown();
  }

  async onDrop(client: Client) {
    if (this.state.phase === "waiting" || this.state.phase === "ended") {
      return;
    }
    const playerId = client.sessionId;
    if (this.isEliminated(playerId)) {
      return;
    }
    if (this.withBots) {
      this.leaveForGood(playerId);
      return;
    }
    this.setConnection(playerId, "reconnecting");
    this.restartTurnOf(playerId);
    const reservation = this.reserveSeat(client);
    if (!reservation) {
      return;
    }
    this.clock.setTimeout(() => {
      if (this.reservations.get(playerId) === reservation) {
        this.leaveForGood(playerId);
      }
    }, RECONNECTION_MS);
    await this.rememberSeat(client);
  }

  async onReconnect(client: Client) {
    const playerId = client.sessionId;
    this.reservations.delete(playerId);
    this.setConnection(playerId, "connected");
    this.apply(playerId, { type: "rejoinMatch" });
    this.restartTurnOf(playerId);
    await this.forgetSeat(playerId);
  }

  async onLeave(client: Client, code?: number) {
    if (!this.game) {
      this.removePlayer(client.sessionId);
      if (this.state.players.size < MIN_PLAYERS) {
        this.stopCountdown();
      }
      return;
    }
    if (this.game.phase === "ended") {
      return;
    }
    if (this.isEliminated(client.sessionId)) {
      this.setConnection(client.sessionId, "left");
      this.stopMatchWhenNobodyIsLeft();
      return;
    }
    if (code !== CloseCode.CONSENTED) {
      return;
    }
    this.reserveSeat(client);
    await this.rememberSeat(client);
    this.leaveForGood(client.sessionId);
  }

  private isEliminated(playerId: string) {
    return this.state.players.get(playerId)?.eliminated === true;
  }

  private reserveSeat(client: Client): Reservation | undefined {
    const reservation = this.allowReconnection(client, "manual");
    reservation.catch(() => {});
    if (!(reservation instanceof Deferred)) {
      return undefined;
    }
    this.reservations.set(client.sessionId, reservation);
    return reservation;
  }

  private async rememberSeat(client: Client) {
    const userId = this.userIds.get(client.sessionId);
    if (this.chips && userId) {
      await openMatches.keepSeat(userId, { matchId: this.state.matchId, reconnectionToken: `${this.roomId}:${client.reconnectionToken}` });
    }
  }

  private async forgetSeat(playerId: string) {
    const userId = this.userIds.get(playerId);
    if (userId) {
      await openMatches.forgetSeat(userId);
    }
  }

  private async closeOpenMatch() {
    this.reservations.forEach((reservation) => reservation.reject());
    this.reservations.clear();
    await Promise.all([...this.userIds.values()].map((userId) => openMatches.forgetSeat(userId)));
    if (this.state.matchId) {
      await openMatches.forgetMatch(this.state.matchId);
    }
  }

  private leaveForGood(playerId: string) {
    this.setConnection(playerId, "left");
    this.apply(playerId, { type: "leaveMatch" });
    this.restartTurnOf(playerId);
    this.stopMatchWhenNobodyIsLeft();
  }

  private restartTurnOf(playerId: string) {
    if (this.game?.phase === "playing" && this.state.currentTurn === playerId) {
      this.startTurnTimer();
    }
  }

  private setConnection(playerId: string, connection: Connection) {
    const player = this.state.players.get(playerId);
    if (player) {
      player.connection = connection;
    }
  }

  private stopMatchWhenNobodyIsLeft() {
    const people = [...this.state.players.values()].filter((player) => !player.bot);
    if (this.game?.phase !== "roundOver" || people.some((player) => player.connection !== "left")) {
      return;
    }
    this.stopMatch();
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
        this.endRound(event);
        return;
      case "returnOffered":
        this.offerReturn(event.playerIds);
        return;
      case "returned":
        this.announceBriefly("returned", event.playerId);
        this.closeReturnWindowWhenDecided();
        return;
      case "eliminated":
        this.announceBriefly("eliminated", event.playerId);
        this.chips?.eliminate(event.playerId).catch((error) => this.logFailure("Falha ao registrar a eliminação", error));
        this.closeReturnWindowWhenDecided();
        return;
      case "matchEnded":
        this.endMatch(event.winner, event.reason === "points");
        return;
    }
  }

  private startCountdownWhenEnoughSeated() {
    if (this.withBots || this.state.players.size < MIN_PLAYERS || this.state.countdownDuration > 0) {
      return;
    }
    this.state.countdownNumber++;
    this.state.countdownDuration = COUNTDOWN_MS;
    this.countdownTimer = this.clock.setTimeout(() => this.startMatch(), COUNTDOWN_MS);
  }

  private stopCountdown() {
    this.countdownTimer?.clear();
    this.state.countdownDuration = 0;
  }

  private startMatch() {
    this.stopCountdown();
    this.lock();
    this.openChipsMatch();
    this.showRound(startMatch(this.state.order.toArray(), { lifeJoker: false }));
  }

  private openChipsMatch() {
    if (this.state.table === PRACTICE_TABLE) {
      return;
    }
    const seats = [...this.userIds].map(([playerId, userId]) => ({ playerId, userId }));
    this.chips = new ChipsMatch({ api: this.gameApi, roomId: this.roomId, table: this.state.table, seats });
    this.chips
      .open()
      .then((opened) => {
        this.state.matchId = opened.matchId;
        this.state.pointValue = opened.pointValue;
        this.mirrorFinances(opened.finances);
      })
      .catch((error) => this.abortMatch(error));
  }

  private settleChips(winnerId: string) {
    if (!this.chips) {
      return;
    }
    const players = this.game?.players ?? [];
    const losers = players.filter((player) => player.id !== winnerId && player.roundPoints > 0).map((player) => ({ playerId: player.id, handPoints: player.roundPoints }));
    this.registering = true;
    this.chips
      .settleRound({ winnerId, losers })
      .then((finances) => {
        this.mirrorFinances(finances);
        this.registering = false;
        this.showWinner(this.winnerToShow);
        this.winnerToShow = "";
        this.startNextRoundWhenReady();
      })
      .catch((error) => this.abortMatch(error));
  }

  private abortMatch(error: unknown) {
    this.logFailure("Partida de fichas abortada", error);
    if (this.aborted) {
      return;
    }
    this.aborted = true;
    this.winnerToShow = "";
    this.stopMatch();
    this.disconnect(CLOSE_CODES.matchAborted);
  }

  private endMatch(winner: string, awardWinBonus: boolean) {
    this.finishChips(winner ? { winnerId: winner, awardWinBonus } : NO_WINNER);
    void this.closeOpenMatch();
    if (this.registering) {
      this.winnerToShow = winner;
      return;
    }
    this.showWinner(winner);
  }

  private showWinner(winner: string) {
    if (!winner) {
      return;
    }
    this.state.winner = winner;
    this.announce("won", winner);
  }

  private stopMatch() {
    this.turnTimer?.clear();
    this.nextRoundTimer?.clear();
    this.returnTimer?.clear();
    this.state.turnDuration = 0;
    this.state.returnDuration = 0;
    if (this.game) {
      this.game = abandonMatch(this.game);
      mirrorGame(this.state, this.game);
    }
    this.finishChips(NO_WINNER);
    void this.closeOpenMatch();
  }

  private logFailure(message: string, error: unknown) {
    console.error(message, { sala: this.roomId, ...describeFailure(error) });
  }

  private finishChips(result: MatchResult) {
    return this.chips?.finish(result).catch((error) => this.logFailure("Falha ao encerrar a partida de fichas", error));
  }

  private mirrorFinances(finances: ChipsFinance[]) {
    for (const finance of finances) {
      const player = this.state.players.get(finance.playerId);
      if (!player) {
        continue;
      }
      player.roundChips = finance.result - player.chipsResult;
      player.chipsResult = finance.result;
      player.chipsDeficit = finance.deficit;
      player.chipsBalance = finance.balance;
    }
  }

  private offerReturn(playerIds: string[]) {
    this.state.returnNumber++;
    this.state.returnDuration = RETURN_MS;
    this.returnTimer?.clear();
    this.returnTimer = this.clock.setTimeout(() => this.returnUndecided(), RETURN_MS);
    playerIds.filter((id) => this.playsByItself(id)).forEach((id) => this.apply(id, { type: "chooseReturn", back: true }));
  }

  private playsByItself(playerId: string) {
    const player = this.state.players.get(playerId);
    return player?.bot || player?.connection !== "connected";
  }

  private returnUndecided() {
    const undecided = this.game?.players.filter((player) => player.awaitingReturn) ?? [];
    undecided.forEach((player) => this.apply(player.id, { type: "chooseReturn", back: true }));
  }

  private closeReturnWindowWhenDecided() {
    if (this.game?.players.some((player) => player.awaitingReturn)) {
      return;
    }
    this.returnTimer?.clear();
    this.state.returnDuration = 0;
    this.startNextRoundWhenReady();
  }

  private startNextRoundWhenReady() {
    const game = this.game;
    if (game?.phase !== "roundOver" || !this.breakElapsed || this.registering) {
      return;
    }
    if (game.players.some((player) => player.awaitingReturn)) {
      return;
    }
    this.breakElapsed = false;
    this.showRound(startRound(game));
  }

  private showRound(game: Game) {
    this.game = game;
    mirrorGame(this.state, game);
    this.announce("");
    this.startTurnTimer();
  }

  private endRound({ wentOut, reason }: Extract<GameEvent, { type: "roundEnded" }>) {
    this.turnTimer?.clear();
    this.state.turnDuration = 0;
    this.announce(reason === "goOut" ? "wentOut" : "outOfCards", wentOut);
    this.settleChips(wentOut);
    if (this.game?.phase !== "roundOver") {
      return;
    }
    this.breakElapsed = false;
    this.nextRoundTimer = this.clock.setTimeout(() => {
      this.breakElapsed = true;
      this.startNextRoundWhenReady();
    }, NEXT_ROUND_DELAY_MS);
    this.stopMatchWhenNobodyIsLeft();
  }

  private startTurnTimer() {
    this.turnTimer?.clear();
    const playerId = this.state.currentTurn;
    if (!this.playsByItself(playerId)) {
      this.scheduleTurnPlay(TURN_MS);
      return;
    }
    this.apply(playerId, { type: "draw" });
    if (this.game?.phase === "playing") {
      this.scheduleTurnPlay(AUTOMATIC_TURN_MS);
    }
  }

  private scheduleTurnPlay(delay: number) {
    this.state.turnNumber++;
    this.state.turnDuration = delay;
    this.turnTimer = this.clock.setTimeout(() => this.playForCurrentPlayer(), delay);
  }

  private playForCurrentPlayer() {
    const playerId = this.game?.currentTurn ?? "";
    if (!this.game?.hasDrawn) {
      this.apply(playerId, { type: "draw" });
      if (this.game?.phase === "playing") {
        this.scheduleTurnPlay(AUTOMATIC_TURN_MS);
      }
      return;
    }
    const fullPlay = this.state.players.get(playerId)?.bot || !this.somePersonIsConnected();
    const action: Action = fullPlay ? { type: "playAutomatically" } : { type: "playMovementOnly" };
    this.apply(playerId, action);
  }

  private somePersonIsConnected() {
    return [...this.state.players.values()].some((player) => !player.bot && !player.eliminated && player.connection === "connected");
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

  private addPlayer(id: string, name: string, photoUrl: string, bot: boolean) {
    const player = new Player();
    player.name = name;
    player.photoUrl = photoUrl;
    player.bot = bot;
    this.state.players.set(id, player);
    this.state.order.push(id);
  }

  private removePlayer(id: string) {
    this.state.players.delete(id);
    this.userIds.delete(id);
    const seat = this.state.order.indexOf(id);
    if (seat !== -1) {
      this.state.order.splice(seat, 1);
    }
  }

  private addBots() {
    for (let number = 1; this.state.order.length < this.state.seats; number++) {
      this.addPlayer(`bot-${number}`, `Robô ${number}`, "", true);
    }
  }

}
