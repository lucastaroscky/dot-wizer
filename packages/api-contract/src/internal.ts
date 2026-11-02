import { z } from "zod";
import { MIN_PLAYERS, ONLINE_MAX_PLAYERS } from "@pontinho/rules";
import { chipsSchema, isoDateTimeSchema, matchIdSchema, userIdSchema } from "./common.ts";

const tableSchema = z.number().int().positive().describe("Número da mesa (1 a 7).");

export const pingResponseSchema = z.object({
  ok: z.literal(true).describe("Sempre verdadeiro: o segredo de serviço foi aceito."),
});
export type PingResponse = z.infer<typeof pingResponseSchema>;

export const playerEntryBodySchema = z.strictObject({
  accessToken: z.string().min(1).describe("Token de acesso do Supabase que o cliente mandou ao servidor do jogo."),
  table: tableSchema.optional().describe("Mesa que o jogador quer. Omitida na partida de treino com robôs."),
});
export type PlayerEntryBody = z.infer<typeof playerEntryBodySchema>;

export const playerEntryResponseSchema = z.object({
  userId: userIdSchema,
  name: z.string().nullable().describe("Nome de jogo."),
  photoUrl: z.string().nullable().describe("URL pública da foto, se houver."),
  profileComplete: z.boolean().describe("Verdadeiro quando a conta tem nome e data de nascimento."),
  balance: chipsSchema.describe("Saldo atual."),
  minimumBalance: chipsSchema.nullable().describe("Saldo mínimo da mesa. Nulo quando não foi pedida mesa."),
  canJoin: z.boolean().nullable().describe("Saldo suficiente para a mesa. Nulo quando não foi pedida mesa."),
  openMatchId: matchIdSchema.nullable().describe("Partida não encerrada em que a conta está, ou nulo. A API não recusa por isso."),
});
export type PlayerEntryResponse = z.infer<typeof playerEntryResponseSchema>;

export const startMatchBodySchema = z.strictObject({
  table: tableSchema,
  playerIds: z
    .array(userIdSchema)
    .min(MIN_PLAYERS)
    .max(ONLINE_MAX_PLAYERS)
    .refine((ids) => new Set(ids).size === ids.length, "playerIds must be unique")
    .describe("Contas da partida, sem repetir. Robôs não entram."),
});
export type StartMatchBody = z.infer<typeof startMatchBodySchema>;

export const startMatchResponseSchema = z.object({
  matchId: matchIdSchema,
  table: z.number().int().describe("Número da mesa."),
  pointValue: z.number().int().describe("Fichas por ponto da mesa."),
  players: z
    .array(z.object({ userId: userIdSchema, startBalance: chipsSchema.describe("Saldo ao começar a partida.") }))
    .describe("Jogadores com o saldo inicial. Nada é descontado ao começar."),
});
export type StartMatchResponse = z.infer<typeof startMatchResponseSchema>;

export const registerRoundBodySchema = z
  .strictObject({
    roundNumber: z.number().int().min(1).describe("Número da rodada, a partir de 1. Precisa ser a próxima da partida."),
    winnerId: userIdSchema.describe("Quem bateu ou venceu a rodada."),
    losers: z
      .array(
        z.strictObject({
          userId: userIdSchema,
          handPoints: z.number().int().min(0).describe("Pontos da mão do perdedor na rodada."),
        }),
      )
      .min(1)
      .describe("Perdedores que jogaram a rodada, sem repetir e sem o vencedor."),
  })
  .refine(
    ({ winnerId, losers }) => {
      const ids = losers.map(({ userId }) => userId);
      return new Set(ids).size === ids.length && !ids.includes(winnerId);
    },
    "losers must be unique and must not include the winner",
  );
export type RegisterRoundBody = z.infer<typeof registerRoundBodySchema>;

export const playerFinanceSchema = z.object({
  userId: userIdSchema,
  startBalance: chipsSchema.describe("Saldo ao começar a partida."),
  result: chipsSchema.describe("Resultado acumulado na partida."),
  deficit: chipsSchema.describe("Déficit ainda em aberto."),
  balance: chipsSchema.describe("Saldo atual da carteira."),
});
export type PlayerFinance = z.infer<typeof playerFinanceSchema>;

export const registerRoundResponseSchema = z.object({
  matchId: matchIdSchema,
  lastRound: z.number().int().describe("Última rodada registrada."),
  players: z.array(playerFinanceSchema).describe("Estado financeiro de cada jogador depois da rodada."),
});
export type RegisterRoundResponse = z.infer<typeof registerRoundResponseSchema>;

export const finishMatchBodySchema = z.strictObject({
  winnerId: userIdSchema.nullable().describe("Vencedor, ou nulo quando ninguém venceu."),
  awardWinBonus: z.boolean().describe("Falso registra o vencedor sem pagar o bônus de vitória."),
});
export type FinishMatchBody = z.infer<typeof finishMatchBodySchema>;

export const eliminatePlayerBodySchema = z.strictObject({
  userId: userIdSchema.describe("Conta eliminada: passou de 100 e recusou a volta."),
});
export type EliminatePlayerBody = z.infer<typeof eliminatePlayerBodySchema>;

export const eliminatePlayerResponseSchema = z.object({
  matchId: matchIdSchema,
  userId: userIdSchema,
  eliminatedAt: isoDateTimeSchema.describe("Quando a eliminação foi registrada. Repetir devolve a primeira."),
});
export type EliminatePlayerResponse = z.infer<typeof eliminatePlayerResponseSchema>;
