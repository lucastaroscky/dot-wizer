import { z } from "zod";
import { CHIP_PURCHASE_MINIMUM, CHIP_PURCHASE_STEP } from "./constants.ts";
import { chipsSchema, isoDateTimeSchema } from "./common.ts";

export const purchaseQuantitySchema = z.number().int().min(CHIP_PURCHASE_MINIMUM).multipleOf(CHIP_PURCHASE_STEP);

export const quoteQuerySchema = z.strictObject({
  quantity: z.coerce.number().pipe(purchaseQuantitySchema),
});
export type QuoteQuery = z.infer<typeof quoteQuerySchema>;

export const quoteResponseSchema = z.object({
  quantity: chipsSchema,
  amountCents: z.number().int(),
  minimumQuantity: chipsSchema,
  quantityStep: chipsSchema,
  maximumQuantity: chipsSchema,
});
export type QuoteResponse = z.infer<typeof quoteResponseSchema>;

export const buyBodySchema = z.strictObject({
  quantity: purchaseQuantitySchema,
});
export type BuyBody = z.infer<typeof buyBodySchema>;

export const purchaseStatusSchema = z.enum(["PENDING", "PAID"]);
export type PurchaseStatus = z.infer<typeof purchaseStatusSchema>;

export const purchaseResponseSchema = z.object({
  id: z.uuid(),
  quantity: chipsSchema,
  amountCents: z.number().int(),
  status: purchaseStatusSchema,
  createdAt: isoDateTimeSchema,
  paidAt: isoDateTimeSchema.nullable(),
});
export type PurchaseResponse = z.infer<typeof purchaseResponseSchema>;
