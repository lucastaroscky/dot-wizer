import { z } from "zod";
import { AVATAR_CONTENT_TYPES, PROFILE_NAME_MAX_LENGTH } from "./constants.ts";
import { isoDateSchema, userIdSchema } from "./common.ts";

export const profileResponseSchema = z.object({
  id: userIdSchema,
  email: z.string().describe("E-mail da conta, vindo do token do Supabase."),
  name: z.string().nullable().describe("Nome de jogo. Nulo até o cadastro ser concluído."),
  birthDate: isoDateSchema.nullable().describe("Data de nascimento. Nula até o cadastro ser concluído."),
  photoUrl: z.string().nullable().describe("URL pública da foto, ou nulo quando a conta não tem foto."),
  complete: z.boolean().describe("Verdadeiro quando a conta tem nome e data de nascimento."),
});
export type ProfileResponse = z.infer<typeof profileResponseSchema>;

export const saveProfileBodySchema = z.strictObject({
  name: z.string().trim().min(1).max(PROFILE_NAME_MAX_LENGTH).describe("Nome de jogo, de 1 a 20 caracteres."),
  birthDate: isoDateSchema.describe("Data de nascimento. A conta precisa ter 18 anos ou mais (data de Brasília)."),
  photoPath: z
    .string()
    .min(1)
    .max(200)
    .optional()
    .describe("Caminho devolvido por `POST /profile/photo-upload`, depois de enviar o arquivo. Omitido mantém a foto atual."),
});
export type SaveProfileBody = z.infer<typeof saveProfileBodySchema>;

export const photoUploadBodySchema = z.strictObject({
  contentType: z.enum(AVATAR_CONTENT_TYPES).describe("Tipo do arquivo que será enviado."),
});
export type PhotoUploadBody = z.infer<typeof photoUploadBodySchema>;

export const photoUploadResponseSchema = z.object({
  path: z.string().describe("Caminho do arquivo no armazenamento; vai em `photoPath` ao salvar o perfil."),
  uploadUrl: z.string().describe("URL assinada para enviar o arquivo."),
  token: z.string().describe("Token do envio (`uploadToSignedUrl` do Supabase)."),
});
export type PhotoUploadResponse = z.infer<typeof photoUploadResponseSchema>;
