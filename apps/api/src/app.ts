import Fastify from "fastify";
import type { FastifyInstance } from "fastify";
import { serializerCompiler, validatorCompiler } from "@fastify/type-provider-zod";
import type { ZodTypeProvider } from "@fastify/type-provider-zod";
import { createServices } from "./container.ts";
import type { AppDependencies, Services } from "./container.ts";
import type { Env } from "./common/env/env.ts";
import { registerErrorHandler } from "./common/errors/error-handler.ts";
import { registerSecurity } from "./common/security/security.ts";
import { createAuthenticateHook, decorateRequestWithAuth } from "./modules/auth/auth.hooks.ts";
import { createServiceTokenHook } from "./modules/auth/service-token.ts";
import { internalRoutes } from "./modules/internal/internal.routes.ts";
import { matchesRoutes } from "./modules/matches/matches.routes.ts";
import { profileRoutes } from "./modules/profile/profile.routes.ts";
import { storeRoutes } from "./modules/store/store.routes.ts";
import { walletRoutes } from "./modules/wallet/wallet.routes.ts";

const LOG_LEVELS = { development: "debug", test: "silent", production: "info" };

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
}

export async function buildApp(dependencies: AppDependencies): Promise<FastifyInstance> {
  const { env } = dependencies;
  const app = Fastify({ logger: { level: LOG_LEVELS[env.NODE_ENV] }, trustProxy: env.TRUST_PROXY });
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  registerErrorHandler({ app });
  await registerSecurity({ app, env });
  decorateRequestWithAuth({ app });
  registerRoutes({ app, services: createServices(dependencies), env });
  return app;
}
