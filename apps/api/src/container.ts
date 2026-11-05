import type { JWTVerifyGetKey } from "jose";
import type { PrismaClient } from "./generated/prisma/client.ts";
import type { Env } from "./common/env/env.ts";
import { AuthService } from "./modules/auth/auth.service.ts";
import { TokenVerifier } from "./modules/auth/token-verifier.ts";
import { InternalService } from "./modules/internal/internal.service.ts";
import { MatchesService } from "./modules/matches/matches.service.ts";
import type { AvatarStorage } from "./modules/profile/avatar-storage/avatar-storage.ts";
import { ProfileService } from "./modules/profile/profile.service.ts";
import type { PaymentProvider } from "./modules/store/payment/payment-provider.ts";
import { StoreService } from "./modules/store/store.service.ts";
import { WalletService } from "./modules/wallet/wallet.service.ts";
import { buildRepositories, createUnitOfWork } from "./unit-of-work.ts";
import type { Repositories } from "./unit-of-work.ts";
import type { UnitOfWork } from "./common/database/database-client.ts";

export interface AppDependencies {
  env: Env;
  prisma: PrismaClient;
  keySet: JWTVerifyGetKey;
  avatarStorage: AvatarStorage;
  paymentProvider: PaymentProvider;
  now?: () => Date;
}

export interface Services {
  auth: AuthService;
  profile: ProfileService;
  wallet: WalletService;
  store: StoreService;
  matches: MatchesService;
  internal: InternalService;
}

export function supabaseIssuer({ supabaseUrl }: { supabaseUrl: string }): string {
  return new URL("/auth/v1", supabaseUrl).href;
}

interface BuildInput {
  dependencies: AppDependencies;
  repositories: Repositories;
  unitOfWork: UnitOfWork<Repositories>;
  now: () => Date;
}

function createAuth({ dependencies, repositories }: BuildInput): AuthService {
  const { env, keySet } = dependencies;
  const tokenVerifier = new TokenVerifier({
    keySet,
    issuer: supabaseIssuer({ supabaseUrl: env.SUPABASE_URL }),
    devLoginSecret: env.DEV_LOGIN_SECRET,
  });
  return new AuthService({ tokenVerifier, usersRepository: repositories.users });
}

function createStore({ dependencies, repositories, unitOfWork, now }: BuildInput): StoreService {
  return new StoreService({
    unitOfWork,
    purchasesRepository: repositories.purchases,
    paymentProvider: dependencies.paymentProvider,
    chipPriceCents: dependencies.env.CHIP_PRICE_CENTS,
    maxChipsPerPurchase: dependencies.env.MAX_CHIPS_PER_PURCHASE,
    now,
  });
}

function createMatches({ repositories, unitOfWork, now }: BuildInput): MatchesService {
  return new MatchesService({
    unitOfWork,
    matchesRepository: repositories.matches,
    walletRepository: repositories.wallet,
    usersRepository: repositories.users,
    now,
  });
}

function createInternal({ auth, profile, wallet, matches }: Omit<Services, "store" | "internal">): InternalService {
  return new InternalService({
    authService: auth,
    profileService: profile,
    walletService: wallet,
    matchesService: matches,
  });
}

export function createServices(dependencies: AppDependencies): Services {
  const now = dependencies.now ?? (() => new Date());
  const repositories = buildRepositories({ client: dependencies.prisma });
  const unitOfWork = createUnitOfWork({ prisma: dependencies.prisma });
  const input = { dependencies, repositories, unitOfWork, now };
  const auth = createAuth(input);
  const profile = new ProfileService({
    usersRepository: repositories.users,
    avatarStorage: dependencies.avatarStorage,
    unitOfWork,
    now,
  });
  const wallet = new WalletService({ walletRepository: repositories.wallet, now });
  const matches = createMatches(input);
  const internal = createInternal({ auth, profile, wallet, matches });
  return { auth, profile, wallet, store: createStore(input), matches, internal };
}
