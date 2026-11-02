import { z } from "zod";
import { CHIP_PURCHASE_MINIMUM, CHIP_PURCHASE_STEP, IDEMPOTENCY_KEY_HEADER } from "./constants.ts";
import { chipsSchema, isoDateTimeSchema } from "./common.ts";

export const purchaseQuantitySchema = z
  .number()
  .int()
  .min(CHIP_PURCHASE_MINIMUM)
  .multipleOf(CHIP_PURCHASE_STEP)
  .describe("Fichas a comprar: múltiplo de 1.000, no mínimo 1.000.");

export const quoteQuerySchema = z.strictObject({
  quantity: z.coerce
    .number()
    .int()
    .min(CHIP_PURCHASE_MINIMUM)
    .multipleOf(CHIP_PURCHASE_STEP)
    .describe("Fichas a cotar: múltiplo de 1.000, no mínimo 1.000."),
});
export type QuoteQuery = z.infer<typeof quoteQuerySchema>;

export const quoteResponseSchema = z.object({
  quantity: chipsSchema.describe("Fichas cotadas."),
  amountCents: z.number().int().describe("Valor em centavos de real."),
  minimumQuantity: chipsSchema.describe("Menor quantidade por compra."),
  quantityStep: chipsSchema.describe("A quantidade precisa ser múltipla deste valor."),
  maximumQuantity: chipsSchema.describe("Maior quantidade por compra."),
});
export type QuoteResponse = z.infer<typeof quoteResponseSchema>;

export const buyBodySchema = z.strictObject({
  quantity: purchaseQuantitySchema,
});
export type BuyBody = z.infer<typeof buyBodySchema>;

export const buyHeadersSchema = z.object({
  [IDEMPOTENCY_KEY_HEADER]: z
    .uuid()
    .describe("UUID novo a cada compra. Repetir a mesma chave devolve a mesma compra, sem cobrar de novo."),
});

export const purchaseStatusSchema = z.enum(["PENDING", "PAID"]).describe("Situação do pagamento.");
export type PurchaseStatus = z.infer<typeof purchaseStatusSchema>;

export const purchaseResponseSchema = z.object({
  id: z.uuid().describe("Identificador da compra."),
  quantity: chipsSchema.describe("Fichas compradas."),
  amountCents: z.number().int().describe("Valor em centavos de real."),
  status: purchaseStatusSchema,
  createdAt: isoDateTimeSchema,
  paidAt: isoDateTimeSchema.nullable().describe("Quando o pagamento foi confirmado, ou nulo se ainda estiver pendente."),
});
export type PurchaseResponse = z.infer<typeof purchaseResponseSchema>;
