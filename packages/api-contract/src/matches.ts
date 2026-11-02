import { z } from "zod";
import { chipsSchema, isoDateTimeSchema, matchIdSchema, userIdSchema } from "./common.ts";

export const matchParamsSchema = z.strictObject({
  matchId: matchIdSchema,
});
export type MatchParams = z.infer<typeof matchParamsSchema>;

export const matchStatusSchema = z.enum(["IN_PROGRESS", "FINISHED"]).describe("Partida em andamento ou encerrada.");
export type MatchStatus = z.infer<typeof matchStatusSchema>;

export const matchPlayerSummarySchema = z.object({
  userId: userIdSchema,
  name: z.string().nullable().describe("Nome de jogo do jogador."),
  startBalance: chipsSchema.describe("Saldo ao começar a partida."),
  paid: chipsSchema.describe("Total pago aos vencedores das rodadas."),
  received: chipsSchema.describe("Total recebido dos perdedores das rodadas."),
  deficitCleared: chipsSchema.describe("Parte dos ganhos que abateu o déficit e ficou com a casa."),
  deficit: chipsSchema.describe("Déficit que sobrou ao fim."),
  winBonus: chipsSchema.describe("Bônus de vitória recebido."),
  result: chipsSchema.describe("Resultado acumulado das rodadas (recebido menos pago menos déficit abatido)."),
  finalBalance: chipsSchema.nullable().describe("Saldo final. Nulo enquanto a partida e o jogador seguem em jogo."),
});
export type MatchPlayerSummary = z.infer<typeof matchPlayerSummarySchema>;

export const matchHistoryResponseSchema = z.object({
  id: matchIdSchema,
  table: z.number().int().describe("Número da mesa."),
  pointValue: z.number().int().describe("Fichas por ponto da mesa."),
  status: matchStatusSchema,
  winnerId: userIdSchema.nullable().describe("Vencedor, ou nulo quando ninguém venceu ou a partida segue em andamento."),
  startedAt: isoDateTimeSchema,
  finishedAt: isoDateTimeSchema.nullable().describe("Encerramento, ou nulo se a partida segue em andamento."),
  players: z.array(matchPlayerSummarySchema).describe("Dinheiro de cada jogador na partida."),
});
export type MatchHistoryResponse = z.infer<typeof matchHistoryResponseSchema>;
