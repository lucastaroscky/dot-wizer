import type { FastifyPluginAsyncZod } from "@fastify/type-provider-zod";
import {
  photoUploadBodySchema,
  photoUploadResponseSchema,
  profileResponseSchema,
  saveProfileBodySchema,
} from "@pontinho/api-contract";
import type { ProfileService } from "./profile.service.ts";

const getProfileSchema = { response: { 200: profileResponseSchema } };
const saveProfileSchema = { body: saveProfileBodySchema, response: { 200: profileResponseSchema } };
const photoUploadSchema = { body: photoUploadBodySchema, response: { 200: photoUploadResponseSchema } };

export function profileRoutes({ service }: { service: ProfileService }): FastifyPluginAsyncZod {
  return async (app) => {
    app.get("/profile", { schema: getProfileSchema }, (request) => service.get({ userId: request.auth.userId }));
    app.put("/profile", { schema: saveProfileSchema }, (request) =>
      service.save({ userId: request.auth.userId, ...request.body }),
    );
    app.post("/profile/photo-upload", { schema: photoUploadSchema }, (request) =>
      service.requestPhotoUpload({ userId: request.auth.userId, ...request.body }),
    );
  };
}
