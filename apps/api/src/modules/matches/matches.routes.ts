import type { FastifyPluginAsyncZod } from "@fastify/type-provider-zod";
import { matchHistoryResponseSchema, matchParamsSchema } from "@pontinho/api-contract";
import { APP_SECURITY, appErrors, TAGS } from "../../common/openapi/route-docs.ts";
import type { MatchesService } from "./matches.service.ts";

const getHistorySchema = {
  summary: "Ler o histórico de uma partida",
  description:
    "Saldo inicial, pagamentos, recebimentos, déficit, bônus de vitória, resultado e saldo final de cada jogador. Só quem jogou a partida vê; para os outros a partida não existe.",
  tags: [TAGS.matches],
  security: APP_SECURITY,
  params: matchParamsSchema,
  response: { 200: matchHistoryResponseSchema, ...appErrors({ codes: ["validationFailed", "matchNotFound"] }) },
};

export function matchesRoutes({ service }: { service: MatchesService }): FastifyPluginAsyncZod {
  return async (app) => {
    app.get("/matches/:matchId", { schema: getHistorySchema }, (request) =>
      service.getHistory({ userId: request.auth.userId, matchId: request.params.matchId }),
    );
  };
}
