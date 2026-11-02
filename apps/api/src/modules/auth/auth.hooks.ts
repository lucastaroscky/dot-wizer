import type { FastifyInstance, FastifyRequest } from "fastify";
import type { AuthContext, AuthService } from "./auth.service.ts";

declare module "fastify" {
  interface FastifyRequest {
    auth: AuthContext;
  }
}

export function decorateRequestWithAuth({ app }: { app: FastifyInstance }): void {
  app.decorateRequest("auth", null as never);
}

export function createAuthenticateHook({ authService }: { authService: AuthService }) {
  return async function authenticate(request: FastifyRequest): Promise<void> {
    request.auth = await authService.authenticate({ authorization: request.headers.authorization });
  };
}
