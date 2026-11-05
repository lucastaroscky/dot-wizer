import type { FastifyPluginAsyncZod } from "@fastify/type-provider-zod";
import { SignJWT } from "jose";
import { DEV_ACCOUNTS, devAccountsResponseSchema, devLoginBodySchema, devLoginResponseSchema, type DevLoginBody } from "@pontinho/api-contract";
import { appErrors } from "../../common/openapi/route-docs.ts";
import { DEV_LOGIN_ALGORITHM, SUPABASE_AUDIENCE } from "./token-verifier.ts";

const DEV_TOKEN_LIFETIME = "12h";

const DEV_USER_IDS: Record<DevLoginBody["account"], string> = {
  qa1: "00000000-0000-4000-8000-000000000001",
  qa2: "00000000-0000-4000-8000-000000000002",
  qa3: "00000000-0000-4000-8000-000000000003",
  qa4: "00000000-0000-4000-8000-000000000004",
};

const listSchema = {
  summary: "Listar as contas de teste",
  description: "Só existe com NODE_ENV=development e DEV_LOGIN_SECRET. O app usa a resposta para mostrar os botões de login de teste.",
  response: { 200: devAccountsResponseSchema },
};

const loginSchema = {
  summary: "Entrar com uma conta de teste",
  description: "Só existe com NODE_ENV=development e DEV_LOGIN_SECRET. A conta é criada no primeiro uso, como no login de verdade.",
  body: devLoginBodySchema,
  response: { 200: devLoginResponseSchema, ...appErrors({ codes: ["validationFailed"] }) },
};

export function devLoginRoutes({ secret, issuer }: { secret: string; issuer: string }): FastifyPluginAsyncZod {
  const key = new TextEncoder().encode(secret);
  return async (app) => {
    app.get("/dev/login", { schema: listSchema }, () => ({ accounts: [...DEV_ACCOUNTS] }));
    app.post("/dev/login", { schema: loginSchema }, async (request) => {
      const { account } = request.body;
      const userId = DEV_USER_IDS[account];
      const accessToken = await new SignJWT({ email: `${account}@pontinho.test` })
        .setProtectedHeader({ alg: DEV_LOGIN_ALGORITHM })
        .setSubject(userId)
        .setIssuer(issuer)
        .setAudience(SUPABASE_AUDIENCE)
        .setIssuedAt()
        .setExpirationTime(DEV_TOKEN_LIFETIME)
        .sign(key);
      return { accessToken, userId };
    });
  };
}
