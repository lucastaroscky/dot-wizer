import type { PrismaClient } from "./generated/prisma/client.ts";
import type { DatabaseClient, UnitOfWork } from "./common/database/database-client.ts";
import { MatchesRepository } from "./modules/matches/repository/matches.repository.ts";
import { PurchasesRepository } from "./modules/store/repository/purchases.repository.ts";
import { UsersRepository } from "./modules/users/repository/users.repository.ts";
import { WalletRepository } from "./modules/wallet/repository/wallet.repository.ts";

export interface Repositories {
  users: UsersRepository;
  wallet: WalletRepository;
  purchases: PurchasesRepository;
  matches: MatchesRepository;
}

export function buildRepositories({ client }: { client: DatabaseClient }): Repositories {
  return {
    users: new UsersRepository({ client }),
    wallet: new WalletRepository({ client }),
    purchases: new PurchasesRepository({ client }),
    matches: new MatchesRepository({ client }),
  };
}

export function createUnitOfWork({ prisma }: { prisma: PrismaClient }): UnitOfWork<Repositories> {
  return {
    run: (work) => prisma.$transaction((transaction) => work(buildRepositories({ client: transaction }))),
  };
}
