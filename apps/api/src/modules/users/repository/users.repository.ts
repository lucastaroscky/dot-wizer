import { Prisma } from "../../../generated/prisma/client.ts";
import type { DatabaseClient } from "../../../common/database/database-client.ts";
import { fromIsoDate, toIsoDate } from "../../../common/database/dates.ts";

const userSelect = {
  id: true,
  email: true,
  nickname: true,
  fullName: true,
  cpf: true,
  birthDate: true,
  phone: true,
  photoPath: true,
  pixKeyRegisteredAt: true,
  active: true,
} satisfies Prisma.UserSelect;

type UserRow = Prisma.UserGetPayload<{ select: typeof userSelect }>;

export interface UserRecord {
  id: string;
  email: string;
  nickname: string | null;
  fullName: string | null;
  cpf: string | null;
  birthDate: string | null;
  phone: string | null;
  photoPath: string | null;
  pixKeyRegisteredAt: Date | null;
  active: boolean;
}

interface FindOrCreateInput {
  id: string;
  email: string;
}

interface FindByIdInput {
  id: string;
}

interface FindByIdsInput {
  ids: string[];
}

interface RegisterInput {
  id: string;
  fullName: string;
  cpf: string;
  birthDate: string;
  nickname: string;
}

interface UpdateInput {
  id: string;
  nickname?: string;
  phone?: string;
  photoPath?: string;
}

interface UpdateEmailInput {
  id: string;
  email: string;
}

interface RegisterPixKeyInput {
  id: string;
  registeredAt: Date;
}

interface DeactivateInput {
  id: string;
  deactivatedAt: Date;
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

  async findOrCreate({ id, email }: FindOrCreateInput): Promise<UserRecord> {
    const existing = await this.findById({ id });
    if (existing) {
      return existing;
    }
    await this.client.user.createMany({ data: [{ id, email }], skipDuplicates: true });
    const row = await this.client.user.findUniqueOrThrow({ where: { id }, select: userSelect });
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

  async register({ id, fullName, cpf, birthDate, nickname }: RegisterInput): Promise<UserRecord | null> {
    const { count } = await this.client.user.updateMany({
      where: { id, cpf: null },
      data: { fullName, cpf, birthDate: fromIsoDate({ isoDate: birthDate }), nickname },
    });
    if (count === 0) {
      return null;
    }
    return this.findById({ id });
  }

  async update({ id, nickname, phone, photoPath }: UpdateInput): Promise<UserRecord> {
    const row = await this.client.user.update({ where: { id }, data: { nickname, phone, photoPath }, select: userSelect });
    return toRecord(row);
  }

  async updateEmail({ id, email }: UpdateEmailInput): Promise<void> {
    await this.client.user.update({ where: { id }, data: { email } });
  }

  async registerPixKey({ id, registeredAt }: RegisterPixKeyInput): Promise<void> {
    await this.client.user.updateMany({ where: { id, pixKeyRegisteredAt: null }, data: { pixKeyRegisteredAt: registeredAt } });
  }

  async deactivate({ id, deactivatedAt }: DeactivateInput): Promise<void> {
    await this.client.user.update({ where: { id }, data: { active: false, deactivatedAt } });
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
