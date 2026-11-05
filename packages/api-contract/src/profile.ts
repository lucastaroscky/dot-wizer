import { z } from "zod";
import { AVATAR_CONTENT_TYPES, FULL_NAME_MAX_LENGTH, NICKNAME_MAX_LENGTH } from "./constants.ts";
import { isoDateSchema, userIdSchema } from "./common.ts";

const CPF_PATTERN = /^\d{11}$/;
const REPEATED_DIGITS = /^(\d)\1{10}$/;

function cpfCheckDigit(digits: number[]) {
  const sum = digits.reduce((total, digit, index) => total + digit * (digits.length + 1 - index), 0);
  const remainder = sum % 11;
  return remainder < 2 ? 0 : 11 - remainder;
}

export function isValidCpf(cpf: string) {
  if (!CPF_PATTERN.test(cpf) || REPEATED_DIGITS.test(cpf)) {
    return false;
  }
  const digits = [...cpf].map(Number);
  return cpfCheckDigit(digits.slice(0, 9)) === digits[9] && cpfCheckDigit(digits.slice(0, 10)) === digits[10];
}

export const cpfSchema = z
  .string()
  .refine(isValidCpf, { message: "CPF inválido" })
  .describe("CPF com os 11 dígitos, sem máscara. Os dois dígitos verificadores são conferidos.");

const nicknameSchema = z.string().trim().min(1).max(NICKNAME_MAX_LENGTH).describe("Apelido no jogo, de 1 a 20 caracteres. É o nome que aparece na mesa.");

export const profileResponseSchema = z.object({
  id: userIdSchema,
  email: z.string().describe("E-mail da conta, vindo do token do Supabase."),
  nickname: z.string().nullable().describe("Apelido no jogo. Nulo até o cadastro."),
  fullName: z.string().nullable().describe("Nome completo. Nulo até o cadastro, que trava o campo."),
  cpf: z.string().nullable().describe("CPF com os 11 dígitos. Só sai para a própria conta. Nulo até o cadastro, que trava o campo."),
  birthDate: isoDateSchema.nullable().describe("Data de nascimento. Nula até o cadastro, que trava o campo."),
  photoUrl: z.string().nullable().describe("URL pública da foto, ou nulo quando a conta não tem foto."),
  complete: z.boolean().describe("Verdadeiro quando a conta tem nome completo, CPF, data de nascimento e apelido."),
});
export type ProfileResponse = z.infer<typeof profileResponseSchema>;

export const registrationBodySchema = z.strictObject({
  fullName: z.string().trim().min(1).max(FULL_NAME_MAX_LENGTH).describe("Nome completo, de 1 a 100 caracteres."),
  cpf: cpfSchema,
  birthDate: isoDateSchema.describe("Data de nascimento. A conta precisa ter 18 anos ou mais (data de Brasília)."),
  nickname: nicknameSchema,
});
export type RegistrationBody = z.infer<typeof registrationBodySchema>;

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
