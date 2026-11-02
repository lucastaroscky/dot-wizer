import { z } from "zod";
import { AVATAR_CONTENT_TYPES, PROFILE_NAME_MAX_LENGTH } from "./constants.ts";
import { isoDateSchema, userIdSchema } from "./common.ts";

export const profileResponseSchema = z.object({
  id: userIdSchema,
  email: z.string(),
  name: z.string().nullable(),
  birthDate: isoDateSchema.nullable(),
  photoUrl: z.string().nullable(),
  complete: z.boolean(),
});
export type ProfileResponse = z.infer<typeof profileResponseSchema>;

export const saveProfileBodySchema = z.strictObject({
  name: z.string().trim().min(1).max(PROFILE_NAME_MAX_LENGTH),
  birthDate: isoDateSchema,
  photoPath: z.string().min(1).max(200).optional(),
});
export type SaveProfileBody = z.infer<typeof saveProfileBodySchema>;

export const photoUploadBodySchema = z.strictObject({
  contentType: z.enum(AVATAR_CONTENT_TYPES),
});
export type PhotoUploadBody = z.infer<typeof photoUploadBodySchema>;

export const photoUploadResponseSchema = z.object({
  path: z.string(),
  uploadUrl: z.string(),
  token: z.string(),
});
export type PhotoUploadResponse = z.infer<typeof photoUploadResponseSchema>;
