import { ServerError } from "colyseus";
import { createOptionsSchema, JOIN_REFUSALS, PRACTICE_TABLE, type JoinRefusal } from "@pontinho/protocol";
import { GameApiError, type GameApi } from "../../gameApi/GameApi.js";

export type PlayerAuth = { id: string; name: string; photoUrl: string; table: number };

export function refuse(refusal: JoinRefusal) {
  const { code, message } = JOIN_REFUSALS[refusal];
  return new ServerError(code, message);
}

async function enter(gameApi: GameApi, accessToken: string, table: number | undefined) {
  try {
    return await gameApi.playerEntry({ accessToken, table });
  } catch (error) {
    if (error instanceof GameApiError && error.status === 401) {
      throw refuse("invalidToken");
    }
    console.error("Falha ao consultar o jogador na API:", error);
    throw refuse("apiUnavailable");
  }
}

export function createPlayerAuthenticator(gameApi: GameApi) {
  return async (token: string | undefined, options: unknown): Promise<PlayerAuth> => {
    if (!token) {
      throw refuse("invalidToken");
    }
    const parsed = createOptionsSchema.safeParse(options);
    if (!parsed.success) {
      throw refuse("invalidOptions");
    }
    const chipsTable = parsed.data.bots ? undefined : parsed.data.table;
    const entry = await enter(gameApi, token, chipsTable);
    if (!entry.profileComplete || entry.name === null) {
      throw refuse("profileIncomplete");
    }
    if (entry.canJoin === false) {
      throw refuse("insufficientBalance");
    }
    return { id: entry.userId, name: entry.name, photoUrl: entry.photoUrl ?? "", table: chipsTable ?? PRACTICE_TABLE };
  };
}
