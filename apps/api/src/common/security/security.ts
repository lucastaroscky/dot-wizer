import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import type { FastifyInstance } from "fastify";
import { IDEMPOTENCY_KEY_HEADER, SERVICE_TOKEN_HEADER } from "@pontinho/api-contract";
import type { Env } from "../env/env.ts";
import { ApiError } from "../errors/api-error.ts";
import { isServiceToken } from "../../modules/auth/service-token.ts";

interface RegisterSecurityInput {
  app: FastifyInstance;
  env: Env;
}

export async function registerSecurity({ app, env }: RegisterSecurityInput): Promise<void> {
  await app.register(cors, {
    origin: env.CORS_ORIGINS,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Authorization", "Content-Type", IDEMPOTENCY_KEY_HEADER],
  });
  await app.register(rateLimit, {
    global: false,
    max: env.RATE_LIMIT_MAX,
    timeWindow: "1 minute",
    allowList: (request) =>
      isServiceToken({ provided: request.headers[SERVICE_TOKEN_HEADER], expected: env.SERVICE_TOKEN }),
    errorResponseBuilder: () => new ApiError({ code: "tooManyRequests" }),
  });
  app.addHook("onRequest", app.rateLimit());
}
