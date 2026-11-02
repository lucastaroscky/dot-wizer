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

const EXAMPLE_SERVICE_TOKEN = "troque-por-um-segredo-com-pelo-menos-32-caracteres";

function parseTrustProxy(value: string): boolean | string {
  if (value === "true") {
    return true;
  }
  if (value === "false") {
    return false;
  }
  return value;
}

const baseEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  HOST: z.string().min(1).default("0.0.0.0"),
  DATABASE_URL: z.url(),
  SUPABASE_URL: z.url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  SUPABASE_AVATAR_BUCKET: z.string().min(1).default("avatars"),
  SERVICE_TOKEN: z
    .string()
    .min(32)
    .refine((token) => token !== EXAMPLE_SERVICE_TOKEN, "SERVICE_TOKEN cannot be the example value"),
  CORS_ORIGINS: originListSchema,
  TRUST_PROXY: z.string().default("false").transform(parseTrustProxy),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(120),
  PAYMENT_PROVIDER: z.enum(["test"]),
  CHIP_PRICE_CENTS: z.coerce.number().int().positive().default(100),
  MAX_CHIPS_PER_PURCHASE: z.coerce.number().int().positive().default(200_000),
});

interface PaymentProviderRuleInput {
  NODE_ENV: string;
  PAYMENT_PROVIDER: string;
}

function isPaymentProviderAllowed({ NODE_ENV, PAYMENT_PROVIDER }: PaymentProviderRuleInput): boolean {
  if (NODE_ENV !== "production") {
    return true;
  }
  return PAYMENT_PROVIDER !== "test";
}

const envSchema = baseEnvSchema.refine(isPaymentProviderAllowed, {
  path: ["PAYMENT_PROVIDER"],
  message: "PAYMENT_PROVIDER test is not allowed in production",
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
