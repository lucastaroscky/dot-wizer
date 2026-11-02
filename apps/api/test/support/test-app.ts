import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { SERVICE_TOKEN_HEADER } from "@pontinho/api-contract";
import { buildApp } from "../../src/app.ts";
import { createServices } from "../../src/container.ts";
import type { AppDependencies, Services } from "../../src/container.ts";
import { loadEnv } from "../../src/common/env/env.ts";
import { TestPaymentProvider } from "../../src/modules/store/payment/test-payment-provider.ts";
import { FakeAvatarStorage } from "./fake-avatar-storage.ts";
import { signTestToken, TEST_SUPABASE_URL, testKeySet } from "./test-keys.ts";
import { migrateTestDatabase, resetDatabase, TEST_DATABASE_URL, testPrisma } from "./test-database.ts";

export const TEST_SERVICE_TOKEN = "t".repeat(40);
export const TEST_ORIGIN = "http://localhost:8081";

interface SignedInUser {
  userId: string;
  email: string;
  headers: { authorization: string };
}

export interface TestApp {
  app: FastifyInstance;
  services: Services;
  clock: { now: Date };
  avatarStorage: FakeAvatarStorage;
  serviceHeaders: Record<string, string>;
  signIn(input?: { userId?: string; email?: string }): Promise<SignedInUser>;
  reset(): Promise<void>;
}

export async function createTestApp(envOverrides: Record<string, string> = {}): Promise<TestApp> {
  migrateTestDatabase();
  const clock = { now: new Date("2026-11-02T15:00:00Z") };
  const avatarStorage = new FakeAvatarStorage();
  const dependencies: AppDependencies = {
    env: loadEnv({
      source: {
        NODE_ENV: "test",
        DATABASE_URL: TEST_DATABASE_URL,
        SUPABASE_URL: TEST_SUPABASE_URL,
        SUPABASE_SERVICE_ROLE_KEY: "test-service-role-key",
        SERVICE_TOKEN: TEST_SERVICE_TOKEN,
        CORS_ORIGINS: TEST_ORIGIN,
        RATE_LIMIT_MAX: "1000",
        PAYMENT_PROVIDER: "test",
        ...envOverrides,
      },
    }),
    prisma: testPrisma,
    keySet: testKeySet,
    avatarStorage,
    paymentProvider: new TestPaymentProvider(),
    now: () => clock.now,
  };
  const app = await buildApp(dependencies);
  await app.ready();
  return {
    app,
    services: createServices(dependencies),
    clock,
    avatarStorage,
    serviceHeaders: { [SERVICE_TOKEN_HEADER]: TEST_SERVICE_TOKEN },
    signIn: async ({ userId = randomUUID(), email = `${userId}@example.com` } = {}) => ({
      userId,
      email,
      headers: { authorization: `Bearer ${await signTestToken({ userId, email })}` },
    }),
    reset: resetDatabase,
  };
}
