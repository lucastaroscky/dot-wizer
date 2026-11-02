import { z } from "zod";
import { chipsSchema, isoDateTimeSchema, matchIdSchema, userIdSchema } from "./common.ts";

export const matchParamsSchema = z.strictObject({
  matchId: matchIdSchema,
});
export type MatchParams = z.infer<typeof matchParamsSchema>;

export const matchStatusSchema = z.enum(["IN_PROGRESS", "FINISHED"]);
export type MatchStatus = z.infer<typeof matchStatusSchema>;

export const matchPlayerSummarySchema = z.object({
  userId: userIdSchema,
  name: z.string().nullable(),
  startBalance: chipsSchema,
  paid: chipsSchema,
  received: chipsSchema,
  deficitCleared: chipsSchema,
  deficit: chipsSchema,
  winBonus: chipsSchema,
  result: chipsSchema,
  finalBalance: chipsSchema.nullable(),
});
export type MatchPlayerSummary = z.infer<typeof matchPlayerSummarySchema>;

export const matchHistoryResponseSchema = z.object({
  id: matchIdSchema,
  table: z.number().int(),
  pointValue: z.number().int(),
  status: matchStatusSchema,
  winnerId: userIdSchema.nullable(),
  startedAt: isoDateTimeSchema,
  finishedAt: isoDateTimeSchema.nullable(),
  players: z.array(matchPlayerSummarySchema),
});
export type MatchHistoryResponse = z.infer<typeof matchHistoryResponseSchema>;
