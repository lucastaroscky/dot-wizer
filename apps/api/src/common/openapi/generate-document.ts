import { createLocalJWKSet } from "jose";
import { buildApp } from "../../app.ts";
import { TestPaymentProvider } from "../../modules/store/payment/test-payment-provider.ts";
import type { AvatarStorage } from "../../modules/profile/avatar-storage/avatar-storage.ts";
import { createPrisma } from "../database/prisma.ts";
import { loadEnv } from "../env/env.ts";

const PLACEHOLDER_ENV = {
  NODE_ENV: "development",
  DATABASE_URL: "postgresql://openapi:openapi@localhost:5432/openapi",
  SUPABASE_URL: "https://project.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "openapi",
  SERVICE_TOKEN: "o".repeat(40),
  PAYMENT_PROVIDER: "test",
};

const UNUSED_AVATAR_STORAGE: AvatarStorage = {
  createUploadUrl: () => Promise.reject(new Error("The document generator does not upload files")),
  publicUrl: () => "",
};

export async function generateOpenApiDocument(): Promise<object> {
  const env = loadEnv({ source: PLACEHOLDER_ENV });
  const prisma = createPrisma({ databaseUrl: env.DATABASE_URL });
  const app = await buildApp({
    env,
    prisma,
    keySet: createLocalJWKSet({ keys: [] }),
    avatarStorage: UNUSED_AVATAR_STORAGE,
    paymentProvider: new TestPaymentProvider(),
  });
  try {
    await app.ready();
    return app.swagger();
  } finally {
    await app.close();
    await prisma.$disconnect();
  }
}
