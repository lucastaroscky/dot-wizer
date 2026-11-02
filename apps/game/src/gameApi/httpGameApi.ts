import { randomUUID } from "node:crypto";
import { errorResponseSchema, SERVICE_TOKEN_HEADER } from "@pontinho/api-contract";
import { GameApiError, type GameApi, type GameApiErrorCode } from "./GameApi.js";

const REQUEST_TIMEOUT_MS = 5_000;
const RETRY_ATTEMPTS = 3;
const REQUEST_ID_HEADER = "x-request-id";

const errorCodeSchema = errorResponseSchema.pick({ code: true });

type HttpGameApiInput = {
  url: string;
  serviceToken: string;
  fetch?: typeof fetch;
  retryDelayMs?: number;
};

type Call = { name: string; method: "GET" | "POST"; path: string; body?: unknown };

function isTransient(error: unknown) {
  return !(error instanceof GameApiError) || error.status === 0 || error.status >= 500;
}

function wait(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function failureCode(error: unknown): GameApiErrorCode {
  return error instanceof Error && error.name === "TimeoutError" ? "timeout" : "networkError";
}

async function readCode(response: Response): Promise<GameApiErrorCode> {
  const parsed = errorCodeSchema.safeParse(await response.json().catch(() => undefined));
  return parsed.success ? parsed.data.code : "invalidResponse";
}

export function createHttpGameApi({ url, serviceToken, fetch: fetchImplementation = fetch, retryDelayMs = 500 }: HttpGameApiInput): GameApi {
  async function send<T>(call: Call, requestId: string, attempt: number): Promise<T> {
    const response = await fetchImplementation(`${url}/internal${call.path}`, {
      method: call.method,
      headers: { "content-type": "application/json", [SERVICE_TOKEN_HEADER]: serviceToken, [REQUEST_ID_HEADER]: requestId },
      body: call.body === undefined ? undefined : JSON.stringify(call.body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    }).catch((error) => {
      throw new GameApiError({ status: 0, code: failureCode(error), call: call.name, attempt });
    });
    if (!response.ok) {
      throw new GameApiError({ status: response.status, code: await readCode(response), call: call.name, attempt });
    }
    return (await response.json()) as T;
  }

  function sendOnce<T>(call: Call): Promise<T> {
    return send<T>(call, randomUUID(), 1);
  }

  async function sendWithRetries<T>(call: Call): Promise<T> {
    const requestId = randomUUID();
    for (let attempt = 1; ; attempt++) {
      try {
        return await send<T>(call, requestId, attempt);
      } catch (error) {
        if (attempt === RETRY_ATTEMPTS || !isTransient(error)) {
          throw error;
        }
        await wait(retryDelayMs);
      }
    }
  }

  return {
    ping: () => sendOnce({ name: "ping", method: "GET", path: "/ping" }),
    playerEntry: (body) => sendOnce({ name: "playerEntry", method: "POST", path: "/players/entry", body }),
    startMatch: (body) => sendOnce({ name: "startMatch", method: "POST", path: "/matches", body }),
    registerRound: ({ matchId, ...body }) => sendWithRetries({ name: "registerRound", method: "POST", path: `/matches/${matchId}/rounds`, body }),
    finishMatch: ({ matchId, ...body }) => sendWithRetries({ name: "finishMatch", method: "POST", path: `/matches/${matchId}/finish`, body }),
    eliminatePlayer: ({ matchId, ...body }) => sendWithRetries({ name: "eliminatePlayer", method: "POST", path: `/matches/${matchId}/eliminations`, body }),
  };
}
