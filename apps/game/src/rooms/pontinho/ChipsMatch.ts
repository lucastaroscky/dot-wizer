import type { GameApi } from "../../gameApi/GameApi.js";

export type ChipsSeat = { playerId: string; userId: string };
export type ChipsFinance = { playerId: string; result: number; deficit: number; balance: number };
export type OpenedChipsMatch = { matchId: string; pointValue: number; finances: ChipsFinance[] };
export type RoundLoser = { playerId: string; handPoints: number };
export type RoundResult = { winnerId: string; losers: RoundLoser[] };

type ChipsMatchInput = { api: GameApi; table: number; seats: ChipsSeat[] };

export class ChipsMatch {
  private readonly api: GameApi;
  private readonly table: number;
  private readonly seats: ChipsSeat[];
  private queue: Promise<unknown> = Promise.resolve();
  private matchId = "";
  private roundNumber = 0;
  private finishing?: Promise<void>;

  constructor({ api, table, seats }: ChipsMatchInput) {
    this.api = api;
    this.table = table;
    this.seats = seats;
  }

  open(): Promise<OpenedChipsMatch> {
    return this.enqueue(async () => {
      const match = await this.api.startMatch({ table: this.table, playerIds: this.seats.map(({ userId }) => userId) });
      this.matchId = match.matchId;
      const finances = match.players.map(({ userId, startBalance }) => ({ playerId: this.playerIdOf(userId), result: 0, deficit: 0, balance: startBalance }));
      return { matchId: match.matchId, pointValue: match.pointValue, finances };
    });
  }

  settleRound({ winnerId, losers }: RoundResult): Promise<ChipsFinance[]> {
    const roundNumber = ++this.roundNumber;
    return this.enqueue(async () => {
      const response = await this.api.registerRound({
        matchId: this.matchId,
        roundNumber,
        winnerId: this.userIdOf(winnerId),
        losers: losers.map(({ playerId, handPoints }) => ({ userId: this.userIdOf(playerId), handPoints })),
      });
      return response.players.map(({ userId, result, deficit, balance }) => ({ playerId: this.playerIdOf(userId), result, deficit, balance }));
    });
  }

  finish(winnerId: string | null): Promise<void> {
    this.finishing ??= this.enqueue(async () => {
      if (!this.matchId) {
        return;
      }
      await this.api.finishMatch({ matchId: this.matchId, winnerId: winnerId === null ? null : this.userIdOf(winnerId) });
    });
    return this.finishing;
  }

  private enqueue<T>(task: () => Promise<T>): Promise<T> {
    const run = this.queue.then(task);
    this.queue = run.catch(() => undefined);
    return run;
  }

  private userIdOf(playerId: string) {
    const seat = this.seats.find((candidate) => candidate.playerId === playerId);
    if (!seat) {
      throw new Error(`Jogador ${playerId} fora da partida de fichas`);
    }
    return seat.userId;
  }

  private playerIdOf(userId: string) {
    const seat = this.seats.find((candidate) => candidate.userId === userId);
    if (!seat) {
      throw new Error(`Jogador ${userId} fora da partida de fichas`);
    }
    return seat.playerId;
  }
}
