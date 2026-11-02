import type { FastifyPluginAsyncZod } from "@fastify/type-provider-zod";
import {
  eliminatePlayerBodySchema,
  eliminatePlayerResponseSchema,
  finishMatchBodySchema,
  matchHistoryResponseSchema,
  matchParamsSchema,
  playerEntryBodySchema,
  playerEntryResponseSchema,
  registerRoundBodySchema,
  registerRoundResponseSchema,
  startMatchBodySchema,
  startMatchResponseSchema,
} from "@pontinho/api-contract";
import type { MatchesService } from "../matches/matches.service.ts";
import type { InternalService } from "./internal.service.ts";

const playerEntrySchema = { body: playerEntryBodySchema, response: { 200: playerEntryResponseSchema } };
const startMatchSchema = { body: startMatchBodySchema, response: { 201: startMatchResponseSchema } };
const registerRoundSchema = {
  params: matchParamsSchema,
  body: registerRoundBodySchema,
  response: { 200: registerRoundResponseSchema },
};
const eliminatePlayerSchema = {
  params: matchParamsSchema,
  body: eliminatePlayerBodySchema,
  response: { 200: eliminatePlayerResponseSchema },
};
const finishMatchSchema = {
  params: matchParamsSchema,
  body: finishMatchBodySchema,
  response: { 200: matchHistoryResponseSchema },
};

interface InternalRoutesInput {
  internalService: InternalService;
  matchesService: MatchesService;
}

export function internalRoutes({ internalService, matchesService }: InternalRoutesInput): FastifyPluginAsyncZod {
  return async (app) => {
    app.post("/players/entry", { schema: playerEntrySchema }, (request) => internalService.playerEntry(request.body));
    app.post("/matches", { schema: startMatchSchema }, async (request, reply) => {
      reply.code(201);
      return matchesService.start(request.body);
    });
    app.post("/matches/:matchId/rounds", { schema: registerRoundSchema }, (request) =>
      matchesService.registerRound({ matchId: request.params.matchId, ...request.body }),
    );
    app.post("/matches/:matchId/eliminations", { schema: eliminatePlayerSchema }, (request) =>
      matchesService.eliminate({ matchId: request.params.matchId, ...request.body }),
    );
    app.post("/matches/:matchId/finish", { schema: finishMatchSchema }, (request) =>
      matchesService.finish({ matchId: request.params.matchId, ...request.body }),
    );
  };
}
