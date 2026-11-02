import { z } from "zod";
import { chipsSchema, isoDateTimeSchema, matchIdSchema } from "./common.ts";

export const walletEntryTypeSchema = z.enum([
  "PURCHASE",
  "DAILY_BONUS",
  "ROUND_PAYMENT",
  "DEFICIT_OFFSET",
  "WIN_BONUS",
]);
export type WalletEntryType = z.infer<typeof walletEntryTypeSchema>;

export const walletResponseSchema = z.object({
  balance: chipsSchema,
  dailyBonusAvailable: z.boolean(),
});
export type WalletResponse = z.infer<typeof walletResponseSchema>;

export const walletEntriesQuerySchema = z.strictObject({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.uuid().optional(),
});
export type WalletEntriesQuery = z.infer<typeof walletEntriesQuerySchema>;

export const walletEntryResponseSchema = z.object({
  id: z.uuid(),
  type: walletEntryTypeSchema,
  amount: chipsSchema,
  matchId: matchIdSchema.nullable(),
  roundNumber: z.number().int().nullable(),
  createdAt: isoDateTimeSchema,
});
export type WalletEntryResponse = z.infer<typeof walletEntryResponseSchema>;

export const walletEntriesResponseSchema = z.object({
  entries: z.array(walletEntryResponseSchema),
  nextCursor: z.uuid().nullable(),
});
export type WalletEntriesResponse = z.infer<typeof walletEntriesResponseSchema>;

export const dailyBonusResponseSchema = z.object({
  amount: chipsSchema,
  balance: chipsSchema,
});
export type DailyBonusResponse = z.infer<typeof dailyBonusResponseSchema>;
