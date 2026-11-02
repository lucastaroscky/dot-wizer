import { z } from "zod";

const originListSchema = z
  .string()
  .default("")
  .transform((value) =>
    value
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
  );

function parseTrustProxy(value: string): boolean | string {
  if (value === "true") {
    return true;
  }
  if (value === "false") {
    return false;
  }
  return value;
}

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  HOST: z.string().min(1).default("0.0.0.0"),
  DATABASE_URL: z.url(),
  SUPABASE_URL: z.url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  SUPABASE_AVATAR_BUCKET: z.string().min(1).default("avatars"),
  SERVICE_TOKEN: z.string().min(32),
  CORS_ORIGINS: originListSchema,
  TRUST_PROXY: z.string().default("false").transform(parseTrustProxy),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(120),
  PAYMENT_PROVIDER: z.enum(["test"]),
  CHIP_PRICE_CENTS: z.coerce.number().int().positive().default(100),
  MAX_CHIPS_PER_PURCHASE: z.coerce.number().int().positive().default(200_000),
});

export type Env = z.infer<typeof envSchema>;

interface LoadEnvInput {
  source: Record<string, string | undefined>;
}

export function loadEnv({ source }: LoadEnvInput): Env {
  const result = envSchema.safeParse(source);
  if (result.success) {
    return result.data;
  }
  throw new Error(`Invalid environment:\n${z.prettifyError(result.error)}`);
}
