import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import type { FastifyInstance } from "fastify";
import { SERVICE_TOKEN_HEADER } from "@pontinho/api-contract";
import type { Env } from "../env/env.ts";
import { TooManyRequestsError } from "../errors/http-errors.ts";
import errors from "../messages/errors.json" with { type: "json" };
import { isServiceToken } from "../../modules/auth/service-token.ts";

interface RegisterSecurityInput {
  app: FastifyInstance;
  env: Env;
}

export async function registerSecurity({ app, env }: RegisterSecurityInput): Promise<void> {
  await app.register(cors, {
    origin: env.CORS_ORIGINS,
    methods: ["GET", "POST", "PUT", "OPTIONS"],
    allowedHeaders: ["Authorization", "Content-Type"],
  });
  await app.register(rateLimit, {
    global: false,
    max: env.RATE_LIMIT_MAX,
    timeWindow: "1 minute",
    allowList: (request) =>
      isServiceToken({ provided: request.headers[SERVICE_TOKEN_HEADER], expected: env.SERVICE_TOKEN }),
    errorResponseBuilder: () => new TooManyRequestsError(errors.common.tooManyRequests),
  });
  app.addHook("onRequest", app.rateLimit());
}
