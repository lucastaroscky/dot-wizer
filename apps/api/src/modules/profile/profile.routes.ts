import type { FastifyPluginAsyncZod } from "@fastify/type-provider-zod";
import {
  photoUploadBodySchema,
  photoUploadResponseSchema,
  profileResponseSchema,
  registrationBodySchema,
  updateProfileBodySchema,
} from "@pontinho/api-contract";
import { z } from "zod";
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

const updateProfileSchema = {
  summary: "Alterar apelido, celular ou foto",
  description: "Muda só os campos enviados. Nome completo, CPF e data de nascimento não mudam aqui.",
  tags: [TAGS.profile],
  security: APP_SECURITY,
  body: updateProfileBodySchema,
  response: {
    200: profileResponseSchema,
    ...appErrors({ codes: ["validationFailed", "badRequest", "photoNotOwned"] }),
  },
};

const deleteProfileSchema = {
  summary: "Excluir a conta",
  description:
    "Desativa a conta e guarda a carteira e o extrato. O CPF continua preso à conta. Recusa quem está numa partida em andamento. Depois disso, o token da conta recebe `accountDisabled`.",
  tags: [TAGS.profile],
  security: APP_SECURITY,
  response: { 204: z.null().describe("Conta desativada."), ...appErrors({ codes: ["playerAlreadyInMatch"] }) },
};

const photoUploadSchema = {
  summary: "Pedir a URL assinada para enviar a foto",
  description: "Depois do envio, mande o `path` em `photoPath` no `PATCH /profile`.",
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
    app.patch("/profile", { schema: updateProfileSchema }, (request) =>
      service.update({ userId: request.auth.userId, ...request.body }),
    );
    app.delete("/profile", { schema: deleteProfileSchema }, async (request, reply) => {
      await service.deactivate({ userId: request.auth.userId });
      return reply.status(204).send(null);
    });
    app.post("/profile/photo-upload", { schema: photoUploadSchema }, (request) =>
      service.requestPhotoUpload({ userId: request.auth.userId, ...request.body }),
    );
  };
}
