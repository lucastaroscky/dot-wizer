import { Prisma } from "../../../generated/prisma/client.ts";
import type { DatabaseClient } from "../../../common/database/database-client.ts";

const matchSelect = {
  id: true,
  tableId: true,
  pointValue: true,
  status: true,
  winnerId: true,
  lastRound: true,
  startedAt: true,
  finishedAt: true,
  players: {
    select: {
      userId: true,
      startBalance: true,
      result: true,
      deficit: true,
      winBonus: true,
      finalBalance: true,
      eliminatedAt: true,
    },
    orderBy: { userId: "asc" },
  },
} satisfies Prisma.MatchSelect;

export type MatchRecord = Prisma.MatchGetPayload<{ select: typeof matchSelect }>;
export type MatchPlayerRecord = MatchRecord["players"][number];

interface CreateInput {
  tableId: number;
  pointValue: number;
  players: { userId: string; startBalance: number }[];
}

interface MatchIdInput {
  matchId: string;
}

interface UserIdsInput {
  userIds: string[];
}

interface SaveRoundInput extends MatchIdInput {
  roundNumber: number;
  finances: { playerId: string; result: number; deficit: number }[];
}

interface EliminateInput extends MatchIdInput {
  userId: string;
  eliminatedAt: Date;
  finalBalance: number;
}

interface FinishInput extends MatchIdInput {
  winnerId: string | null;
  finishedAt: Date;
  players: { userId: string; winBonus: number; finalBalance?: number }[];
}

export class MatchesRepository {
  private readonly client: DatabaseClient;

  constructor({ client }: { client: DatabaseClient }) {
    this.client = client;
  }

  create({ tableId, pointValue, players }: CreateInput): Promise<MatchRecord> {
    return this.client.match.create({
      data: { tableId, pointValue, players: { create: players } },
      select: matchSelect,
    });
  }

  findById({ matchId }: MatchIdInput): Promise<MatchRecord | null> {
    return this.client.match.findUnique({ where: { id: matchId }, select: matchSelect });
  }

  getById({ matchId }: MatchIdInput): Promise<MatchRecord> {
    return this.client.match.findUniqueOrThrow({ where: { id: matchId }, select: matchSelect });
  }

  async findOpenMatchIdOf({ userId }: { userId: string }): Promise<string | null> {
    const row = await this.client.matchPlayer.findFirst({
      where: { userId, eliminatedAt: null, match: { status: "IN_PROGRESS" } },
      select: { matchId: true },
    });
    return row?.matchId ?? null;
  }

  async findUsersInOpenMatches({ userIds }: UserIdsInput): Promise<string[]> {
    const rows = await this.client.matchPlayer.findMany({
      where: { userId: { in: userIds }, eliminatedAt: null, match: { status: "IN_PROGRESS" } },
      select: { userId: true },
    });
    return rows.map(({ userId }) => userId);
  }

  async lockAndFind({ matchId }: MatchIdInput): Promise<MatchRecord | null> {
    await this.client.$queryRaw`SELECT id FROM matches WHERE id = ${matchId}::uuid FOR UPDATE`;
    return this.findById({ matchId });
  }

  async saveRound({ matchId, roundNumber, finances }: SaveRoundInput): Promise<void> {
    for (const { playerId, result, deficit } of finances) {
      await this.client.matchPlayer.update({
        where: { matchId_userId: { matchId, userId: playerId } },
        data: { result, deficit },
      });
    }
    await this.client.match.update({ where: { id: matchId }, data: { lastRound: roundNumber } });
  }

  async eliminate({ matchId, userId, eliminatedAt, finalBalance }: EliminateInput): Promise<void> {
    await this.client.matchPlayer.update({
      where: { matchId_userId: { matchId, userId } },
      data: { eliminatedAt, finalBalance },
    });
  }

  async finish({ matchId, winnerId, finishedAt, players }: FinishInput): Promise<void> {
    for (const { userId, winBonus, finalBalance } of players) {
      await this.client.matchPlayer.update({
        where: { matchId_userId: { matchId, userId } },
        data: { winBonus, finalBalance },
      });
    }
    await this.client.match.update({
      where: { id: matchId },
      data: { status: "FINISHED", winnerId, finishedAt },
    });
  }
}
