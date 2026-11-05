import type { FastifyPluginAsyncZod } from "@fastify/type-provider-zod";
import {
  photoUploadBodySchema,
  photoUploadResponseSchema,
  profileResponseSchema,
  registrationBodySchema,
} from "@pontinho/api-contract";
import { APP_SECURITY, appErrors, TAGS } from "../../common/openapi/route-docs.ts";
import type { ProfileService } from "./profile.service.ts";

const getProfileSchema = {
  summary: "Ler o perfil",
  description: "Devolve o perfil da conta. Na primeira chamada a conta é criada, ainda sem cadastro.",
  tags: [TAGS.profile],
  security: APP_SECURITY,
  response: { 200: profileResponseSchema, ...appErrors({ codes: ["profileNotFound"] }) },
};

const registrationSchema = {
  summary: "Fazer o cadastro",
  description:
    "Grava nome completo, CPF, data de nascimento e apelido, uma vez só: depois de salvo, o cadastro trava. Só quem tem 18 anos ou mais (data de Brasília) conclui o cadastro. Um CPF por conta.",
  tags: [TAGS.profile],
  security: APP_SECURITY,
  body: registrationBodySchema,
  response: {
    200: profileResponseSchema,
    ...appErrors({ codes: ["validationFailed", "badRequest", "underage", "cpfAlreadyRegistered", "registrationLocked"] }),
  },
};

const photoUploadSchema = {
  summary: "Pedir a URL assinada para enviar a foto",
  description: "Devolve o caminho e a URL assinada para enviar a foto ao armazenamento.",
  tags: [TAGS.profile],
  security: APP_SECURITY,
  body: photoUploadBodySchema,
  response: { 200: photoUploadResponseSchema, ...appErrors({ codes: ["validationFailed", "badRequest"] }) },
};

export function profileRoutes({ service }: { service: ProfileService }): FastifyPluginAsyncZod {
  return async (app) => {
    app.get("/profile", { schema: getProfileSchema }, (request) => service.get({ userId: request.auth.userId }));
    app.post("/profile/registration", { schema: registrationSchema }, (request) =>
      service.register({ userId: request.auth.userId, ...request.body }),
    );
    app.post("/profile/photo-upload", { schema: photoUploadSchema }, (request) =>
      service.requestPhotoUpload({ userId: request.auth.userId, ...request.body }),
    );
  };
}
