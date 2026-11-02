import type { FastifyPluginAsyncZod } from "@fastify/type-provider-zod";
import {
  buyBodySchema,
  buyHeadersSchema,
  IDEMPOTENCY_KEY_HEADER,
  purchaseResponseSchema,
  quoteQuerySchema,
  quoteResponseSchema,
} from "@pontinho/api-contract";
import { APP_SECURITY, appErrors, TAGS } from "../../common/openapi/route-docs.ts";
import type { StoreService } from "./store.service.ts";

const quoteSchema = {
  summary: "Cotar uma quantidade de fichas",
  description: "Devolve o valor em centavos e os limites de uma compra (mínimo, passo e máximo).",
  tags: [TAGS.store],
  security: APP_SECURITY,
  querystring: quoteQuerySchema,
  response: { 200: quoteResponseSchema, ...appErrors({ codes: ["validationFailed", "quantityAboveMaximum"] }) },
};

const buySchema = {
  summary: "Comprar fichas",
  description:
    "Cria a compra e chama o provedor de pagamento. Com o provedor de teste a compra é aprovada na hora e nada é cobrado. Repetir a mesma `Idempotency-Key` devolve a mesma compra.",
  tags: [TAGS.store],
  security: APP_SECURITY,
  headers: buyHeadersSchema,
  body: buyBodySchema,
  response: {
    201: purchaseResponseSchema,
    ...appErrors({ codes: ["validationFailed", "badRequest", "quantityAboveMaximum", "idempotencyKeyReused"] }),
  },
};

export function storeRoutes({ service }: { service: StoreService }): FastifyPluginAsyncZod {
  return async (app) => {
    app.get("/store/quote", { schema: quoteSchema }, (request) => service.quote(request.query));
    app.post("/store/purchases", { schema: buySchema }, async (request, reply) => {
      reply.code(201);
      return service.buy({
        userId: request.auth.userId,
        idempotencyKey: request.headers[IDEMPOTENCY_KEY_HEADER],
        ...request.body,
      });
    });
  };
}
