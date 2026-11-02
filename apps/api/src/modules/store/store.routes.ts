import type { FastifyPluginAsyncZod } from "@fastify/type-provider-zod";
import { buyBodySchema, purchaseResponseSchema, quoteQuerySchema, quoteResponseSchema } from "@pontinho/api-contract";
import type { StoreService } from "./store.service.ts";

const quoteSchema = { querystring: quoteQuerySchema, response: { 200: quoteResponseSchema } };
const buySchema = { body: buyBodySchema, response: { 201: purchaseResponseSchema } };

export function storeRoutes({ service }: { service: StoreService }): FastifyPluginAsyncZod {
  return async (app) => {
    app.get("/store/quote", { schema: quoteSchema }, (request) => service.quote(request.query));
    app.post("/store/purchases", { schema: buySchema }, async (request, reply) => {
      reply.code(201);
      return service.buy({ userId: request.auth.userId, ...request.body });
    });
  };
}
