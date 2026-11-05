import type { EliminatePlayerResponse, MatchHistoryResponse, PingResponse, PlayerEntryBody, PlayerEntryResponse, RegisterRoundResponse, StartMatchBody, StartMatchResponse } from "@pontinho/api-contract";
import { CHIP_TABLES, settleRound, type MatchFinance } from "@pontinho/rules";
import { API_ERROR_STATUS } from "@pontinho/api-contract";
import { GameApiError, type EliminatePlayerInput, type FinishMatchInput, type GameApi, type GameApiErrorCode, type RegisterRoundInput } from "../../src/gameApi/GameApi.js";

type Account = { token: string; userId: string; name: string | null; photoUrl: string | null; profileComplete: boolean; balance: number; openMatchId: string | null };

type FakeMatch = { id: string; table: number; pointValue: number; finances: MatchFinance[]; lastRound: number };

type AccountOptions = { balance?: number; profileComplete?: boolean; photoUrl?: string | null; openMatchId?: string };

export function statusOf(code: GameApiErrorCode) {
  if (code === "networkError" || code === "timeout") {
    return 0;
  }
  if (code === "invalidResponse") {
    return 502;
  }
  return API_ERROR_STATUS[code];
}

export class FakeGameApi implements GameApi {
  playerEntries: PlayerEntryBody[] = [];
  startedMatches: StartMatchBody[] = [];
  registeredRounds: RegisterRoundInput[] = [];
  finishedMatches: FinishMatchInput[] = [];
  eliminations: EliminatePlayerInput[] = [];

  private accounts = new Map<string, Account>();
  private matches = new Map<string, FakeMatch>();
  private failures = new Map<string, { times: number; code: GameApiErrorCode }>();
  private roundGate: Promise<void> = Promise.resolve();
  private startGate: Promise<void> = Promise.resolve();

  reset() {
    this.playerEntries = [];
    this.startedMatches = [];
    this.registeredRounds = [];
    this.finishedMatches = [];
    this.eliminations = [];
    this.accounts.clear();
    this.matches.clear();
    this.failures.clear();
    this.roundGate = Promise.resolve();
    this.startGate = Promise.resolve();
  }

  addAccount(name: string, options: AccountOptions = {}) {
    const account: Account = {
      token: `token-${name}`,
      userId: `user-${name}`,
      name,
      photoUrl: options.photoUrl === undefined ? `https://photos.test/${name}.png` : options.photoUrl,
      profileComplete: options.profileComplete ?? true,
      balance: options.balance ?? 100_000,
      openMatchId: options.openMatchId ?? null,
    };
    this.accounts.set(account.token, account);
    return account.token;
  }

  setBalance(name: string, balance: number) {
    const account = [...this.accounts.values()].find((candidate) => candidate.name === name);
    if (account) {
      account.balance = balance;
    }
  }

  userIdOf(name: string) {
    return `user-${name}`;
  }

  failNext(call: "ping" | "playerEntry" | "startMatch" | "registerRound" | "finishMatch" | "eliminatePlayer", times = 1, code: GameApiErrorCode = "internalError") {
    this.failures.set(call, { times, code });
  }

  holdStart() {
    let release = () => {};
    this.startGate = new Promise<void>((resolve) => (release = resolve));
    return release;
  }

  holdRounds() {
    let release = () => {};
    this.roundGate = new Promise<void>((resolve) => (release = resolve));
    return release;
  }

  async ping(): Promise<PingResponse> {
    this.consumeFailure("ping");
    return { ok: true };
  }

  async playerEntry(body: PlayerEntryBody): Promise<PlayerEntryResponse> {
    this.playerEntries.push(body);
    this.consumeFailure("playerEntry");
    const account = this.accounts.get(body.accessToken);
    if (!account) {
      throw new GameApiError({ status: 401, code: "invalidToken", call: "playerEntry" });
    }
    const chipTable = CHIP_TABLES.find(({ id }) => id === body.table);
    return {
      userId: account.userId,
      nickname: account.name,
      photoUrl: account.photoUrl,
      profileComplete: account.profileComplete,
      balance: account.balance,
      minimumBalance: chipTable?.minimumBalance ?? null,
      canJoin: chipTable ? account.balance >= chipTable.minimumBalance : null,
      openMatchId: account.openMatchId,
    };
  }

  async startMatch(body: StartMatchBody): Promise<StartMatchResponse> {
    this.startedMatches.push(body);
    await this.startGate;
    this.consumeFailure("startMatch");
    const chipTable = CHIP_TABLES.find(({ id }) => id === body.table);
    if (!chipTable) {
      throw new GameApiError({ status: 422, code: "tableNotFound", call: "startMatch" });
    }
    const finances = body.playerIds.map((userId) => ({ playerId: userId, startBalance: this.balanceOf(userId), result: 0, deficit: 0 }));
    const match: FakeMatch = { id: `match-${this.matches.size + 1}`, table: chipTable.id, pointValue: chipTable.pointValue, finances, lastRound: 0 };
    this.matches.set(match.id, match);
    return {
      matchId: match.id,
      table: match.table,
      pointValue: match.pointValue,
      players: finances.map(({ playerId, startBalance }) => ({ userId: playerId, startBalance })),
    };
  }

  async registerRound(input: RegisterRoundInput): Promise<RegisterRoundResponse> {
    this.registeredRounds.push(input);
    await this.roundGate;
    this.consumeFailure("registerRound");
    const match = this.matchOf(input.matchId);
    if (input.roundNumber > match.lastRound) {
      const settlement = settleRound({
        finances: match.finances,
        handPoints: Object.fromEntries(input.losers.map(({ userId, handPoints }) => [userId, handPoints])),
        winnerId: input.winnerId,
        pointValue: match.pointValue,
      });
      match.finances = settlement.finances;
      match.lastRound = input.roundNumber;
    }
    return {
      matchId: match.id,
      lastRound: match.lastRound,
      players: match.finances.map(({ playerId, startBalance, result, deficit }) => ({
        userId: playerId,
        startBalance,
        result,
        deficit,
        balance: startBalance + result,
      })),
    };
  }

  async finishMatch(input: FinishMatchInput): Promise<MatchHistoryResponse> {
    this.finishedMatches.push(input);
    this.consumeFailure("finishMatch");
    const match = this.matches.get(input.matchId) ?? { id: input.matchId, table: 1, pointValue: 1, finances: [], lastRound: 0 };
    return {
      id: match.id,
      table: match.table,
      pointValue: match.pointValue,
      status: "FINISHED",
      winnerId: input.winnerId,
      startedAt: new Date(0).toISOString(),
      finishedAt: new Date(1).toISOString(),
      players: match.finances.map(({ playerId, startBalance, result, deficit }) => ({
        userId: playerId,
        nickname: null,
        startBalance,
        paid: 0,
        received: 0,
        deficitCleared: 0,
        deficit,
        winBonus: 0,
        result,
        finalBalance: startBalance + result,
      })),
    };
  }

  async eliminatePlayer(input: EliminatePlayerInput): Promise<EliminatePlayerResponse> {
    this.eliminations.push(input);
    this.consumeFailure("eliminatePlayer");
    return { matchId: input.matchId, userId: input.userId, eliminatedAt: new Date(0).toISOString() };
  }

  setOpenMatch(name: string, openMatchId: string | null) {
    const account = [...this.accounts.values()].find((candidate) => candidate.name === name);
    if (account) {
      account.openMatchId = openMatchId;
    }
  }

  private balanceOf(userId: string) {
    const account = [...this.accounts.values()].find((candidate) => candidate.userId === userId);
    if (!account) {
      throw new GameApiError({ status: 404, code: "playerNotFound", call: "startMatch" });
    }
    return account.balance;
  }

  private matchOf(matchId: string) {
    const match = this.matches.get(matchId);
    if (!match) {
      throw new GameApiError({ status: 404, code: "matchNotFound", call: "registerRound" });
    }
    return match;
  }

  private consumeFailure(call: string) {
    const failure = this.failures.get(call);
    if (!failure || failure.times === 0) {
      return;
    }
    this.failures.set(call, { ...failure, times: failure.times - 1 });
    throw new GameApiError({ status: statusOf(failure.code), code: failure.code, call });
  }
}
