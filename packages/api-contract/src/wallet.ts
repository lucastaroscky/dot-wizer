import { z } from "zod";
import { chipsSchema, isoDateTimeSchema, matchIdSchema } from "./common.ts";

export const walletEntryTypeSchema = z
  .enum(["PURCHASE", "DAILY_BONUS", "ROUND_PAYMENT", "DEFICIT_OFFSET", "WIN_BONUS"])
  .describe("Tipo do lançamento: compra, bônus diário, pagamento de rodada, abatimento de déficit ou bônus de vitória.");
export type WalletEntryType = z.infer<typeof walletEntryTypeSchema>;

export const walletResponseSchema = z.object({
  balance: chipsSchema.describe("Saldo atual em fichas."),
  dailyBonusAvailable: z.boolean().describe("Verdadeiro quando o bônus de hoje (dia de Brasília) ainda não foi resgatado."),
});
export type WalletResponse = z.infer<typeof walletResponseSchema>;

export const walletEntriesQuerySchema = z.strictObject({
  limit: z.coerce.number().int().min(1).max(100).default(20).describe("Itens por página, de 1 a 100."),
  cursor: z.uuid().optional().describe("`nextCursor` da página anterior."),
});
export type WalletEntriesQuery = z.infer<typeof walletEntriesQuerySchema>;

export const walletEntryResponseSchema = z.object({
  id: z.uuid().describe("Identificador do lançamento."),
  type: walletEntryTypeSchema,
  amount: chipsSchema.describe("Fichas do lançamento: positivo quando a conta recebeu, negativo quando pagou."),
  matchId: matchIdSchema.nullable().describe("Partida do lançamento, quando houver."),
  roundNumber: z.number().int().nullable().describe("Rodada do lançamento, quando houver."),
  createdAt: isoDateTimeSchema,
});
export type WalletEntryResponse = z.infer<typeof walletEntryResponseSchema>;

export const walletEntriesResponseSchema = z.object({
  entries: z.array(walletEntryResponseSchema).describe("Lançamentos, do mais novo para o mais antigo."),
  nextCursor: z.uuid().nullable().describe("Valor de `cursor` da próxima página, ou nulo na última."),
});
export type WalletEntriesResponse = z.infer<typeof walletEntriesResponseSchema>;

export const dailyBonusResponseSchema = z.object({
  amount: chipsSchema.describe("Fichas creditadas."),
  balance: chipsSchema.describe("Saldo depois do crédito."),
});
export type DailyBonusResponse = z.infer<typeof dailyBonusResponseSchema>;
