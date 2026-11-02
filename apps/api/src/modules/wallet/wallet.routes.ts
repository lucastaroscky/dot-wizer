import type { FastifyPluginAsyncZod } from "@fastify/type-provider-zod";
import {
  dailyBonusResponseSchema,
  walletEntriesQuerySchema,
  walletEntriesResponseSchema,
  walletResponseSchema,
} from "@pontinho/api-contract";
import type { WalletService } from "./wallet.service.ts";

const getWalletSchema = { response: { 200: walletResponseSchema } };
const listEntriesSchema = { querystring: walletEntriesQuerySchema, response: { 200: walletEntriesResponseSchema } };
const dailyBonusSchema = { response: { 200: dailyBonusResponseSchema } };

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
