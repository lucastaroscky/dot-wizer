import type { FastifyPluginAsyncZod } from "@fastify/type-provider-zod";
import {
  eliminatePlayerBodySchema,
  eliminatePlayerResponseSchema,
  finishMatchBodySchema,
  matchHistoryResponseSchema,
  matchParamsSchema,
  pingResponseSchema,
  playerEntryBodySchema,
  playerEntryResponseSchema,
  registerRoundBodySchema,
  registerRoundResponseSchema,
  startMatchBodySchema,
  startMatchResponseSchema,
} from "@pontinho/api-contract";
import { INTERNAL_SECURITY, internalErrors, TAGS } from "../../common/openapi/route-docs.ts";
import type { MatchesService } from "../matches/matches.service.ts";
import type { InternalService } from "./internal.service.ts";

const pingSchema = {
  summary: "Conferir o segredo de serviço",
  description: "O servidor do jogo chama ao subir para saber se o segredo configurado é aceito.",
  tags: [TAGS.internal],
  security: INTERNAL_SECURITY,
  response: { 200: pingResponseSchema, ...internalErrors() },
};

const playerEntrySchema = {
  summary: "Dados de entrada de um jogador",
  description:
    "Valida o token do jogador e devolve nome, foto, saldo, se o saldo cobre a mesa e a partida aberta da conta. A API não recusa a entrada; quem decide é o servidor do jogo.",
  tags: [TAGS.internal],
  security: INTERNAL_SECURITY,
  body: playerEntryBodySchema,
  response: {
    200: playerEntryResponseSchema,
    ...internalErrors({ codes: ["validationFailed", "badRequest", "invalidToken", "accountDisabled", "tableNotFound"] }),
  },
};

const startMatchSchema = {
  summary: "Iniciar uma partida",
  description:
    "Guarda o saldo inicial de cada jogador. Nada é descontado. Cada jogador precisa ter o saldo mínimo da mesa e não pode estar em outra partida aberta.",
  tags: [TAGS.internal],
  security: INTERNAL_SECURITY,
  body: startMatchBodySchema,
  response: {
    201: startMatchResponseSchema,
    ...internalErrors({
      codes: [
        "validationFailed",
        "badRequest",
        "tableNotFound",
        "playerNotFound",
        "playerAlreadyInMatch",
        "playerBelowMinimumBalance",
      ],
    }),
  },
};

const registerRoundSchema = {
  summary: "Registrar uma rodada",
  description:
    "Cada perdedor paga os pontos da mão vezes o valor do ponto, até o que tem; o resto vira déficit. Repetir uma rodada já registrada devolve o estado atual sem cobrar de novo.",
  tags: [TAGS.internal],
  security: INTERNAL_SECURITY,
  params: matchParamsSchema,
  body: registerRoundBodySchema,
  response: {
    200: registerRoundResponseSchema,
    ...internalErrors({
      codes: [
        "validationFailed",
        "badRequest",
        "matchNotFound",
        "matchAlreadyFinished",
        "roundOutOfOrder",
        "playerNotInMatch",
        "insufficientBalance",
      ],
    }),
  },
};

const eliminatePlayerSchema = {
  summary: "Registrar a eliminação de um jogador",
  description:
    "Quem passou de 100 e recusou a volta fica livre para outra partida. Grava o saldo final da eliminação. Repetir devolve a primeira eliminação.",
  tags: [TAGS.internal],
  security: INTERNAL_SECURITY,
  params: matchParamsSchema,
  body: eliminatePlayerBodySchema,
  response: {
    200: eliminatePlayerResponseSchema,
    ...internalErrors({
      codes: ["validationFailed", "badRequest", "matchNotFound", "matchAlreadyFinished", "playerNotInMatch"],
    }),
  },
};

const finishMatchSchema = {
  summary: "Encerrar uma partida",
  description:
    "Credita o bônus de vitória (10 vezes o valor do ponto) uma única vez e fecha o histórico. Com `awardWinBonus` falso o vencedor fica registrado sem bônus. Repetir com o mesmo resultado é seguro.",
  tags: [TAGS.internal],
  security: INTERNAL_SECURITY,
  params: matchParamsSchema,
  body: finishMatchBodySchema,
  response: {
    200: matchHistoryResponseSchema,
    ...internalErrors({
      codes: ["validationFailed", "badRequest", "matchNotFound", "playerNotInMatch", "winnerEliminated", "winnerChanged"],
    }),
  },
};

interface InternalRoutesInput {
  internalService: InternalService;
  matchesService: MatchesService;
}

export function internalRoutes({ internalService, matchesService }: InternalRoutesInput): FastifyPluginAsyncZod {
  return async (app) => {
    app.get("/ping", { schema: pingSchema }, async () => ({ ok: true as const }));
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
