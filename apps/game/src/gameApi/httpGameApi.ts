import { SERVICE_TOKEN_HEADER } from "@pontinho/api-contract";
import { GameApiError, type GameApi } from "./GameApi.js";

const REQUEST_TIMEOUT_MS = 5_000;
const RETRY_ATTEMPTS = 3;

type HttpGameApiInput = {
  url: string;
  serviceToken: string;
  fetch?: typeof fetch;
  retryDelayMs?: number;
};

function isTransient(error: unknown) {
  return !(error instanceof GameApiError) || error.status >= 500;
}

function wait(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export function createHttpGameApi({ url, serviceToken, fetch: fetchImplementation = fetch, retryDelayMs = 500 }: HttpGameApiInput): GameApi {
  async function post<T>(path: string, body: unknown): Promise<T> {
    const response = await fetchImplementation(`${url}/internal${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", [SERVICE_TOKEN_HEADER]: serviceToken },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) {
      throw new GameApiError(response.status, await response.text());
    }
    return (await response.json()) as T;
  }

  async function postWithRetries<T>(path: string, body: unknown): Promise<T> {
    for (let attempt = 1; ; attempt++) {
      try {
        return await post<T>(path, body);
      } catch (error) {
        if (attempt === RETRY_ATTEMPTS || !isTransient(error)) {
          throw error;
        }
        await wait(retryDelayMs);
      }
    }
  }

  return {
    playerEntry: (body) => post("/players/entry", body),
    startMatch: (body) => post("/matches", body),
    registerRound: ({ matchId, ...body }) => postWithRetries(`/matches/${matchId}/rounds`, body),
    finishMatch: ({ matchId, ...body }) => postWithRetries(`/matches/${matchId}/finish`, body),
    eliminatePlayer: ({ matchId, ...body }) => postWithRetries(`/matches/${matchId}/eliminations`, body),
  };
}
