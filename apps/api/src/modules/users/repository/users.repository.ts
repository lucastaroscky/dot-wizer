import { Prisma } from "../../../generated/prisma/client.ts";
import type { DatabaseClient } from "../../../common/database/database-client.ts";
import { fromIsoDate, toIsoDate } from "../../../common/database/dates.ts";

const userSelect = {
  id: true,
  email: true,
  name: true,
  birthDate: true,
  photoPath: true,
  active: true,
} satisfies Prisma.UserSelect;

type UserRow = Prisma.UserGetPayload<{ select: typeof userSelect }>;

export interface UserRecord {
  id: string;
  email: string;
  name: string | null;
  birthDate: string | null;
  photoPath: string | null;
  active: boolean;
}

interface UpsertInput {
  id: string;
  email: string;
}

interface FindByIdInput {
  id: string;
}

interface FindByIdsInput {
  ids: string[];
}

interface UpdateProfileInput {
  id: string;
  name: string;
  birthDate: string;
  photoPath?: string;
}

interface LockByIdsInput {
  ids: string[];
}

function toRecord(row: UserRow): UserRecord {
  return { ...row, birthDate: row.birthDate ? toIsoDate({ date: row.birthDate }) : null };
}

export class UsersRepository {
  private readonly client: DatabaseClient;

  constructor({ client }: { client: DatabaseClient }) {
    this.client = client;
  }

  async upsert({ id, email }: UpsertInput): Promise<UserRecord> {
    const row = await this.client.user.upsert({
      where: { id },
      update: {},
      create: { id, email },
      select: userSelect,
    });
    return toRecord(row);
  }

  async findById({ id }: FindByIdInput): Promise<UserRecord | null> {
    const row = await this.client.user.findUnique({ where: { id }, select: userSelect });
    return row ? toRecord(row) : null;
  }

  async findByIds({ ids }: FindByIdsInput): Promise<UserRecord[]> {
    const rows = await this.client.user.findMany({ where: { id: { in: ids } }, select: userSelect });
    return rows.map(toRecord);
  }

  async updateProfile({ id, name, birthDate, photoPath }: UpdateProfileInput): Promise<UserRecord> {
    const row = await this.client.user.update({
      where: { id },
      data: { name, birthDate: fromIsoDate({ isoDate: birthDate }), photoPath },
      select: userSelect,
    });
    return toRecord(row);
  }

  async lockByIds({ ids }: LockByIdsInput): Promise<void> {
    if (ids.length === 0) {
      return;
    }
    await this.client.$queryRaw`
      SELECT id FROM users WHERE id IN (${Prisma.join(ids)}) ORDER BY id FOR UPDATE
    `;
  }
}
