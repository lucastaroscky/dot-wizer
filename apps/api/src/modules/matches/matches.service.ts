import { settleRound, winBonus } from "@pontinho/rules";
import type { MatchFinance } from "@pontinho/rules";
import type {
  MatchHistoryResponse,
  RegisterRoundBody,
  RegisterRoundResponse,
  StartMatchBody,
  StartMatchResponse,
} from "@pontinho/api-contract";
import type { UnitOfWork } from "../../common/database/database-client.ts";
import { ConflictError, NotFoundError, UnprocessableError } from "../../common/errors/http-errors.ts";
import errors from "../../common/messages/errors.json" with { type: "json" };
import type { UsersRepository } from "../users/repository/users.repository.ts";
import { HOUSE_ACCOUNT, userAccount } from "../wallet/accounts.ts";
import { postEntries } from "../wallet/post-entries.ts";
import type { WalletRepository } from "../wallet/repository/wallet.repository.ts";
import { findChipTable } from "./find-chip-table.ts";
import { summarizePlayers } from "./match-history.ts";
import type { MatchPlayerRecord, MatchRecord, MatchesRepository } from "./repository/matches.repository.ts";
import { roundEntries } from "./round-entries.ts";

export interface MatchesTransaction {
  matches: MatchesRepository;
  wallet: WalletRepository;
  users: UsersRepository;
}

interface MatchesServiceInput {
  unitOfWork: UnitOfWork<MatchesTransaction>;
  matchesRepository: MatchesRepository;
  walletRepository: WalletRepository;
  usersRepository: UsersRepository;
  now: () => Date;
}

interface MatchIdInput {
  matchId: string;
}

interface RegisterRoundInput extends RegisterRoundBody, MatchIdInput {}

interface FinishInput extends MatchIdInput {
  winnerId: string | null;
}

interface GetHistoryInput extends MatchIdInput {
  userId: string;
}

interface TransactionMatchInput extends MatchIdInput {
  transaction: MatchesTransaction;
}

interface FinancesResponseInput {
  transaction: MatchesTransaction;
  matchId: string;
  lastRound: number;
  finances: MatchFinance[];
}

interface AssertParticipantsInput {
  match: MatchRecord;
  userIds: string[];
}

interface CloseMatchInput extends FinishInput {
  transaction: MatchesTransaction;
}

interface SettleAndSaveInput {
  transaction: MatchesTransaction;
  match: MatchRecord;
  roundNumber: number;
  winnerId: string;
  losers: RegisterRoundBody["losers"];
}

interface FinishedPlayersInput {
  transaction: MatchesTransaction;
  match: MatchRecord;
  winnerId: string | null;
  bonus: number;
}

interface CreditWinBonusInput {
  transaction: MatchesTransaction;
  match: MatchRecord;
  winnerId: string | null;
}

function toFinance(player: MatchPlayerRecord): MatchFinance {
  return { playerId: player.userId, startBalance: player.startBalance, result: player.result, deficit: player.deficit };
}

function assertParticipants({ match, userIds }: AssertParticipantsInput): void {
  const playerIds = match.players.map(({ userId }) => userId);
  if (!userIds.every((userId) => playerIds.includes(userId))) {
    throw new UnprocessableError(errors.matches.playerNotInMatch);
  }
}

export class MatchesService {
  private readonly unitOfWork: UnitOfWork<MatchesTransaction>;
  private readonly matchesRepository: MatchesRepository;
  private readonly walletRepository: WalletRepository;
  private readonly usersRepository: UsersRepository;
  private readonly now: () => Date;

  constructor(input: MatchesServiceInput) {
    this.unitOfWork = input.unitOfWork;
    this.matchesRepository = input.matchesRepository;
    this.walletRepository = input.walletRepository;
    this.usersRepository = input.usersRepository;
    this.now = input.now;
  }

  async start({ table, playerIds }: StartMatchBody): Promise<StartMatchResponse> {
    const chipTable = findChipTable({ table });
    const users = await this.usersRepository.findByIds({ ids: playerIds });
    if (users.length !== playerIds.length) {
      throw new NotFoundError(errors.matches.playerNotFound);
    }
    const accounts = playerIds.map((userId) => userAccount({ userId }));
    const balances = await this.walletRepository.balancesOf({ accounts });
    if (accounts.some((account) => balances[account] < chipTable.minimumBalance)) {
      throw new ConflictError(errors.matches.playerBelowMinimumBalance);
    }
    const players = playerIds.map((userId) => ({ userId, startBalance: balances[userAccount({ userId })] }));
    const match = await this.matchesRepository.create({ tableId: chipTable.id, pointValue: chipTable.pointValue, players });
    return {
      matchId: match.id,
      table: match.tableId,
      pointValue: match.pointValue,
      players: match.players.map(({ userId, startBalance }) => ({ userId, startBalance })),
    };
  }

  registerRound({ matchId, roundNumber, winnerId, losers }: RegisterRoundInput): Promise<RegisterRoundResponse> {
    return this.unitOfWork.run(async (transaction) => {
      const match = await this.lockMatch({ transaction, matchId });
      if (match.status === "FINISHED") {
        throw new ConflictError(errors.matches.alreadyFinished);
      }
      if (roundNumber <= match.lastRound) {
        return this.financesResponse({ transaction, matchId, lastRound: match.lastRound, finances: match.players.map(toFinance) });
      }
      if (roundNumber !== match.lastRound + 1) {
        throw new ConflictError(errors.matches.roundOutOfOrder);
      }
      assertParticipants({ match, userIds: [winnerId, ...losers.map(({ userId }) => userId)] });
      return this.settleAndSave({ transaction, match, roundNumber, winnerId, losers });
    });
  }

  async finish({ matchId, winnerId }: FinishInput): Promise<MatchHistoryResponse> {
    await this.unitOfWork.run((transaction) => this.closeMatch({ transaction, matchId, winnerId }));
    return this.buildHistory({ match: await this.matchesRepository.getById({ matchId }) });
  }

  async getHistory({ userId, matchId }: GetHistoryInput): Promise<MatchHistoryResponse> {
    const match = await this.matchesRepository.findById({ matchId });
    if (!match || !match.players.some((player) => player.userId === userId)) {
      throw new NotFoundError(errors.matches.notFound);
    }
    return this.buildHistory({ match });
  }

  private async lockMatch({ transaction, matchId }: TransactionMatchInput): Promise<MatchRecord> {
    const match = await transaction.matches.lockAndFind({ matchId });
    if (!match) {
      throw new NotFoundError(errors.matches.notFound);
    }
    return match;
  }

  private async settleAndSave(input: SettleAndSaveInput): Promise<RegisterRoundResponse> {
    const { transaction, match, roundNumber, winnerId, losers } = input;
    const settlement = settleRound({
      finances: match.players.map(toFinance),
      handPoints: Object.fromEntries(losers.map(({ userId, handPoints }) => [userId, handPoints])),
      winnerId,
      pointValue: match.pointValue,
    });
    const entries = roundEntries({ matchId: match.id, roundNumber, settlement });
    await postEntries({ repositories: transaction, entries });
    await transaction.matches.saveRound({ matchId: match.id, roundNumber, finances: settlement.finances });
    return this.financesResponse({
      transaction,
      matchId: match.id,
      lastRound: roundNumber,
      finances: settlement.finances,
    });
  }

  private async financesResponse(input: FinancesResponseInput): Promise<RegisterRoundResponse> {
    const { transaction, matchId, lastRound, finances } = input;
    const accounts = finances.map(({ playerId }) => userAccount({ userId: playerId }));
    const balances = await transaction.wallet.balancesOf({ accounts });
    return {
      matchId,
      lastRound,
      players: finances.map(({ playerId, startBalance, result, deficit }) => ({
        userId: playerId,
        startBalance,
        result,
        deficit,
        balance: balances[userAccount({ userId: playerId })],
      })),
    };
  }

  private async closeMatch({ transaction, matchId, winnerId }: CloseMatchInput): Promise<void> {
    const match = await this.lockMatch({ transaction, matchId });
    if (match.status === "FINISHED") {
      this.assertSameResult({ match, winnerId });
      return;
    }
    assertParticipants({ match, userIds: winnerId ? [winnerId] : [] });
    const bonus = await this.creditWinBonus({ transaction, match, winnerId });
    const players = await this.finishedPlayers({ transaction, match, winnerId, bonus });
    await transaction.matches.finish({ matchId, winnerId, finishedAt: this.now(), players });
  }

  private async finishedPlayers(input: FinishedPlayersInput) {
    const { transaction, match, winnerId, bonus } = input;
    const accounts = match.players.map(({ userId }) => userAccount({ userId }));
    const balances = await transaction.wallet.balancesOf({ accounts });
    return match.players.map(({ userId }) => ({
      userId,
      winBonus: userId === winnerId ? bonus : 0,
      finalBalance: balances[userAccount({ userId })],
    }));
  }

  private assertSameResult({ match, winnerId }: { match: MatchRecord; winnerId: string | null }): void {
    if (match.winnerId !== winnerId) {
      throw new ConflictError(errors.matches.winnerChanged);
    }
  }

  private async creditWinBonus({ transaction, match, winnerId }: CreditWinBonusInput): Promise<number> {
    if (!winnerId) {
      return 0;
    }
    const amount = winBonus(match.pointValue);
    await postEntries({
      repositories: transaction,
      entries: [
        {
          fromAccount: HOUSE_ACCOUNT,
          toAccount: userAccount({ userId: winnerId }),
          amount,
          type: "WIN_BONUS",
          idempotencyKey: `match:${match.id}:win-bonus`,
          matchId: match.id,
        },
      ],
    });
    return amount;
  }

  private async buildHistory({ match }: { match: MatchRecord }): Promise<MatchHistoryResponse> {
    const users = await this.usersRepository.findByIds({ ids: match.players.map(({ userId }) => userId) });
    const sums = await this.walletRepository.sumsByMatch({ matchId: match.id });
    return {
      id: match.id,
      table: match.tableId,
      pointValue: match.pointValue,
      status: match.status,
      winnerId: match.winnerId,
      startedAt: match.startedAt.toISOString(),
      finishedAt: match.finishedAt?.toISOString() ?? null,
      players: summarizePlayers({
        players: match.players,
        names: Object.fromEntries(users.map(({ id, name }) => [id, name])),
        sums,
      }),
    };
  }
}
