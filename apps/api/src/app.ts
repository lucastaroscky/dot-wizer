import Fastify from "fastify";
import type { FastifyInstance } from "fastify";
import { serializerCompiler, validatorCompiler } from "@fastify/type-provider-zod";
import type { ZodTypeProvider } from "@fastify/type-provider-zod";
import { createServices, supabaseIssuer } from "./container.ts";
import type { AppDependencies, Services } from "./container.ts";
import type { Env } from "./common/env/env.ts";
import { registerErrorHandler } from "./common/errors/error-handler.ts";
import { registerOpenApi } from "./common/openapi/openapi.ts";
import { registerSecurity } from "./common/security/security.ts";
import { createAuthenticateHook, decorateRequestWithAuth } from "./modules/auth/auth.hooks.ts";
import { devLoginRoutes } from "./modules/auth/dev-login.routes.ts";
import { createServiceTokenHook } from "./modules/auth/service-token.ts";
import { internalRoutes } from "./modules/internal/internal.routes.ts";
import { matchesRoutes } from "./modules/matches/matches.routes.ts";
import { profileRoutes } from "./modules/profile/profile.routes.ts";
import { storeRoutes } from "./modules/store/store.routes.ts";
import { walletRoutes } from "./modules/wallet/wallet.routes.ts";

const REQUEST_ID_HEADER = "x-request-id";
const LOG_LEVELS = { development: "debug", test: "silent", staging: "info", production: "info" };

interface RegisterRoutesInput {
  app: FastifyInstance;
  services: Services;
  env: Env;
}

function registerRoutes({ app, services, env }: RegisterRoutesInput): void {
  const typedApp = app.withTypeProvider<ZodTypeProvider>();
  typedApp.register(async (scope) => {
    scope.addHook("onRequest", createAuthenticateHook({ authService: services.auth }));
    await scope.register(profileRoutes({ service: services.profile }));
    await scope.register(walletRoutes({ service: services.wallet }));
    await scope.register(storeRoutes({ service: services.store }));
    await scope.register(matchesRoutes({ service: services.matches }));
  });
  typedApp.register(
    async (scope) => {
      scope.addHook("onRequest", createServiceTokenHook({ serviceToken: env.SERVICE_TOKEN }));
      await scope.register(internalRoutes({ internalService: services.internal, matchesService: services.matches }));
    },
    { prefix: "/internal" },
  );
  if (env.NODE_ENV === "development" && env.DEV_LOGIN_SECRET) {
    typedApp.register(devLoginRoutes({ secret: env.DEV_LOGIN_SECRET, issuer: supabaseIssuer({ supabaseUrl: env.SUPABASE_URL }) }));
  }
}

export async function buildApp(dependencies: AppDependencies): Promise<FastifyInstance> {
  const { env } = dependencies;
  const app = Fastify({
    logger: { level: LOG_LEVELS[env.NODE_ENV] },
    trustProxy: env.TRUST_PROXY,
    requestIdHeader: REQUEST_ID_HEADER,
  });
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  app.addHook("onRequest", async (request, reply) => {
    reply.header(REQUEST_ID_HEADER, request.id);
  });
  registerErrorHandler({ app });
  await registerSecurity({ app, env });
  await registerOpenApi({ app, nodeEnv: env.NODE_ENV });
  decorateRequestWithAuth({ app });
  registerRoutes({ app, services: createServices(dependencies), env });
  return app;
}
