import { z } from "zod";
import { createServer } from "./createServer.js";
import { createHttpGameApi } from "./gameApi/httpGameApi.js";
import { verifyApiAtBoot } from "./gameApi/verifyApiAtBoot.js";

const env = z.object({ API_URL: z.string().url(), SERVICE_TOKEN: z.string().min(1) }).parse(process.env);

const gameApi = createHttpGameApi({ url: env.API_URL, serviceToken: env.SERVICE_TOKEN });

export default createServer(gameApi, { beforeListen: () => verifyApiAtBoot(gameApi) });
