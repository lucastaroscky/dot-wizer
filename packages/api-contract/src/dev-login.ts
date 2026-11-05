import { z } from "zod";
import { userIdSchema } from "./common.ts";

export const DEV_ACCOUNTS = ["qa1", "qa2", "qa3", "qa4"] as const;

const devAccountSchema = z.enum(DEV_ACCOUNTS).describe("Conta de teste.");

export const devAccountsResponseSchema = z.object({
  accounts: z.array(devAccountSchema).describe("Contas de teste que dá para usar no login local."),
});
export type DevAccountsResponse = z.infer<typeof devAccountsResponseSchema>;

export const devLoginBodySchema = z.strictObject({
  account: devAccountSchema,
});
export type DevLoginBody = z.infer<typeof devLoginBodySchema>;

export const devLoginResponseSchema = z.object({
  accessToken: z.string().describe("Token da conta de teste, aceito pela API e pelo servidor do jogo no lugar do token do Supabase."),
  userId: userIdSchema,
});
export type DevLoginResponse = z.infer<typeof devLoginResponseSchema>;
