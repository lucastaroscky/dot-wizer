import { z } from "zod";
import { createServer } from "./createServer.js";
import { createHttpGameApi } from "./gameApi/httpGameApi.js";

const env = z.object({ API_URL: z.string().url(), SERVICE_TOKEN: z.string().min(1) }).parse(process.env);

export default createServer(createHttpGameApi({ url: env.API_URL, serviceToken: env.SERVICE_TOKEN }));
