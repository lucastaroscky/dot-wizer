import swagger from "@fastify/swagger";
import { jsonSchemaTransform } from "@fastify/type-provider-zod";
import { SERVICE_TOKEN_HEADER } from "@pontinho/api-contract";
import type { FastifyInstance } from "fastify";
import type { Env } from "../env/env.ts";

interface RegisterOpenApiInput {
  app: FastifyInstance;
  nodeEnv: Env["NODE_ENV"];
}

const OPENAPI_DOCUMENT = {
  openapi: "3.0.3",
  info: {
    title: "Pontinho API",
    version: "0.1.0",
    description:
      "Contas, perfil, carteira de fichas, loja e rotas internas do servidor do jogo. Erros seguem o envelope `{ statusCode, code, message }`; o `code` é o identificador estável.",
  },
  components: {
    securitySchemes: {
      bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT", description: "Token de acesso do Supabase." },
      serviceToken: {
        type: "apiKey",
        in: "header",
        name: SERVICE_TOKEN_HEADER,
        description: "Segredo de serviço do servidor do jogo.",
      },
    },
  },
} as const;

export async function registerOpenApi({ app, nodeEnv }: RegisterOpenApiInput): Promise<void> {
  if (nodeEnv === "production") {
    return;
  }
  await app.register(swagger, { openapi: OPENAPI_DOCUMENT, transform: jsonSchemaTransform });
}
