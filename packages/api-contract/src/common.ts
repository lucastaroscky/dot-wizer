import { z } from "zod";

export const userIdSchema = z.uuid();
export const matchIdSchema = z.uuid();
export const isoDateSchema = z.iso.date();
export const isoDateTimeSchema = z.iso.datetime();
export const chipsSchema = z.number().int();

export const errorResponseSchema = z.object({
  statusCode: z.number().int(),
  message: z.union([z.string(), z.array(z.string())]),
  error: z.string(),
  path: z.string(),
  timestamp: isoDateTimeSchema,
});
export type ErrorResponse = z.infer<typeof errorResponseSchema>;
