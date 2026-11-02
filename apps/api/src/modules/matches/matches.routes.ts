import type { FastifyPluginAsyncZod } from "@fastify/type-provider-zod";
import { matchHistoryResponseSchema, matchParamsSchema } from "@pontinho/api-contract";
import type { MatchesService } from "./matches.service.ts";

const getHistorySchema = { params: matchParamsSchema, response: { 200: matchHistoryResponseSchema } };

export function matchesRoutes({ service }: { service: MatchesService }): FastifyPluginAsyncZod {
  return async (app) => {
    app.get("/matches/:matchId", { schema: getHistorySchema }, (request) =>
      service.getHistory({ userId: request.auth.userId, matchId: request.params.matchId }),
    );
  };
}
