import type { FastifyPluginAsyncZod } from "@fastify/type-provider-zod";
import {
  dailyBonusResponseSchema,
  walletEntriesQuerySchema,
  walletEntriesResponseSchema,
  walletResponseSchema,
} from "@pontinho/api-contract";
import { APP_SECURITY, appErrors, TAGS } from "../../common/openapi/route-docs.ts";
import type { WalletService } from "./wallet.service.ts";

const getWalletSchema = {
  summary: "Ler o saldo",
  description: "Saldo em fichas e se o bônus diário ainda pode ser resgatado.",
  tags: [TAGS.wallet],
  security: APP_SECURITY,
  response: { 200: walletResponseSchema, ...appErrors() },
};

const listEntriesSchema = {
  summary: "Listar o extrato",
  description: "Lançamentos da conta, do mais novo para o mais antigo, em páginas por cursor.",
  tags: [TAGS.wallet],
  security: APP_SECURITY,
  querystring: walletEntriesQuerySchema,
  response: { 200: walletEntriesResponseSchema, ...appErrors({ codes: ["validationFailed"] }) },
};

const dailyBonusSchema = {
  summary: "Resgatar o bônus diário",
  description: "100 fichas, uma vez por dia do calendário de Brasília.",
  tags: [TAGS.wallet],
  security: APP_SECURITY,
  response: { 200: dailyBonusResponseSchema, ...appErrors({ codes: ["dailyBonusAlreadyClaimed"] }) },
};

export function walletRoutes({ service }: { service: WalletService }): FastifyPluginAsyncZod {
  return async (app) => {
    app.get("/wallet", { schema: getWalletSchema }, (request) =>
      service.getWallet({ userId: request.auth.userId }),
    );
    app.get("/wallet/entries", { schema: listEntriesSchema }, (request) =>
      service.listEntries({ userId: request.auth.userId, ...request.query }),
    );
    app.post("/wallet/daily-bonus", { schema: dailyBonusSchema }, (request) =>
      service.claimDailyBonus({ userId: request.auth.userId }),
    );
  };
}
