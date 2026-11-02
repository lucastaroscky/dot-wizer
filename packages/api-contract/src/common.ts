import { z } from "zod";

export const userIdSchema = z.uuid().describe("Identificador da conta (o `sub` do token do Supabase).");
export const matchIdSchema = z.uuid().describe("Identificador da partida.");
export const isoDateSchema = z.iso.date().describe("Data no formato AAAA-MM-DD.");
export const isoDateTimeSchema = z.iso.datetime().describe("Instante em UTC no formato ISO 8601.");
export const chipsSchema = z.number().int().describe("Quantidade de fichas (inteiro).");
