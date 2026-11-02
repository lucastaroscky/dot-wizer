import { createRemoteJWKSet } from "jose";
import { buildApp } from "./app.ts";
import { createPrisma } from "./common/database/prisma.ts";
import { loadEnv } from "./common/env/env.ts";
import { supabaseIssuer } from "./container.ts";
import { createSupabaseAvatarStorage } from "./modules/profile/avatar-storage/supabase-avatar-storage.ts";
import { TestPaymentProvider } from "./modules/store/payment/test-payment-provider.ts";

const PAYMENT_PROVIDERS = { test: new TestPaymentProvider() };

async function main(): Promise<void> {
  const env = loadEnv({ source: process.env });
  const prisma = createPrisma({ databaseUrl: env.DATABASE_URL });
  const app = await buildApp({
    env,
    prisma,
    keySet: createRemoteJWKSet(new URL(`${supabaseIssuer({ supabaseUrl: env.SUPABASE_URL })}/.well-known/jwks.json`)),
    avatarStorage: createSupabaseAvatarStorage({ env }),
    paymentProvider: PAYMENT_PROVIDERS[env.PAYMENT_PROVIDER],
  });
  app.addHook("onClose", async () => prisma.$disconnect());
  await app.listen({ port: env.PORT, host: env.HOST });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
