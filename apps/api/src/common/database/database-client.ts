import type { Prisma } from "../../generated/prisma/client.ts";

export type DatabaseClient = Prisma.TransactionClient;

export interface UnitOfWork<Repositories> {
  run<Result>(work: (repositories: Repositories) => Promise<Result>): Promise<Result>;
}
