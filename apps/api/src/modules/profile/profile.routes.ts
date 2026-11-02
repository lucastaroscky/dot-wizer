import type { FastifyPluginAsyncZod } from "@fastify/type-provider-zod";
import {
  photoUploadBodySchema,
  photoUploadResponseSchema,
  profileResponseSchema,
  saveProfileBodySchema,
} from "@pontinho/api-contract";
import { APP_SECURITY, appErrors, TAGS } from "../../common/openapi/route-docs.ts";
import type { ProfileService } from "./profile.service.ts";

const getProfileSchema = {
  summary: "Ler o perfil",
  description: "Devolve o perfil da conta. Na primeira chamada a conta é criada, ainda sem nome e sem data de nascimento.",
  tags: [TAGS.profile],
  security: APP_SECURITY,
  response: { 200: profileResponseSchema, ...appErrors({ codes: ["profileNotFound"] }) },
};

const saveProfileSchema = {
  summary: "Salvar nome, data de nascimento e foto",
  description: "Só quem tem 18 anos ou mais (data de Brasília) conclui o cadastro. A foto é opcional.",
  tags: [TAGS.profile],
  security: APP_SECURITY,
  body: saveProfileBodySchema,
  response: {
    200: profileResponseSchema,
    ...appErrors({ codes: ["validationFailed", "badRequest", "underage", "photoNotOwned"] }),
  },
};

const photoUploadSchema = {
  summary: "Pedir a URL assinada para enviar a foto",
  description: "Depois do envio, mande o `path` em `photoPath` ao salvar o perfil.",
  tags: [TAGS.profile],
  security: APP_SECURITY,
  body: photoUploadBodySchema,
  response: { 200: photoUploadResponseSchema, ...appErrors({ codes: ["validationFailed", "badRequest"] }) },
};

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
