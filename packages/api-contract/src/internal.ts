import { z } from "zod";
import { MATCH_MAX_PLAYERS, MATCH_MIN_PLAYERS } from "./constants.ts";
import { chipsSchema, isoDateTimeSchema, matchIdSchema, userIdSchema } from "./common.ts";

const tableSchema = z.number().int().positive();

export const playerEntryBodySchema = z.strictObject({
  accessToken: z.string().min(1),
  table: tableSchema.optional(),
});
export type PlayerEntryBody = z.infer<typeof playerEntryBodySchema>;

export const playerEntryResponseSchema = z.object({
  userId: userIdSchema,
  name: z.string().nullable(),
  photoUrl: z.string().nullable(),
  profileComplete: z.boolean(),
  balance: chipsSchema,
  minimumBalance: chipsSchema.nullable(),
  canJoin: z.boolean().nullable(),
  openMatchId: matchIdSchema.nullable(),
});
export type PlayerEntryResponse = z.infer<typeof playerEntryResponseSchema>;

export const startMatchBodySchema = z.strictObject({
  table: tableSchema,
  playerIds: z
    .array(userIdSchema)
    .min(MATCH_MIN_PLAYERS)
    .max(MATCH_MAX_PLAYERS)
    .refine((ids) => new Set(ids).size === ids.length, "playerIds must be unique"),
});
export type StartMatchBody = z.infer<typeof startMatchBodySchema>;

export const startMatchResponseSchema = z.object({
  matchId: matchIdSchema,
  table: z.number().int(),
  pointValue: z.number().int(),
  players: z.array(z.object({ userId: userIdSchema, startBalance: chipsSchema })),
});
export type StartMatchResponse = z.infer<typeof startMatchResponseSchema>;

export const registerRoundBodySchema = z
  .strictObject({
    roundNumber: z.number().int().min(1),
    winnerId: userIdSchema,
    losers: z.array(z.strictObject({ userId: userIdSchema, handPoints: z.number().int().min(0) })).min(1),
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
  startBalance: chipsSchema,
  result: chipsSchema,
  deficit: chipsSchema,
  balance: chipsSchema,
});
export type PlayerFinance = z.infer<typeof playerFinanceSchema>;

export const registerRoundResponseSchema = z.object({
  matchId: matchIdSchema,
  lastRound: z.number().int(),
  players: z.array(playerFinanceSchema),
});
export type RegisterRoundResponse = z.infer<typeof registerRoundResponseSchema>;

export const finishMatchBodySchema = z.strictObject({
  winnerId: userIdSchema.nullable(),
  awardWinBonus: z.boolean(),
});
export type FinishMatchBody = z.infer<typeof finishMatchBodySchema>;

export const eliminatePlayerBodySchema = z.strictObject({
  userId: userIdSchema,
});
export type EliminatePlayerBody = z.infer<typeof eliminatePlayerBodySchema>;

export const eliminatePlayerResponseSchema = z.object({
  matchId: matchIdSchema,
  userId: userIdSchema,
  eliminatedAt: isoDateTimeSchema,
});
export type EliminatePlayerResponse = z.infer<typeof eliminatePlayerResponseSchema>;
