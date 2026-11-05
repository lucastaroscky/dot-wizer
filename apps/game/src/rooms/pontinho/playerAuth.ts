import { ServerError } from "colyseus";
import { createOptionsSchema, JOIN_REFUSALS, openMatchRefusalMessage, PRACTICE_TABLE, type JoinRefusal } from "@pontinho/protocol";
import { describeFailure, GameApiError, type GameApi } from "../../gameApi/GameApi.js";
import { NO_WINNER } from "./ChipsMatch.js";
import { openMatches } from "./openMatches.js";

export type PlayerAuth = { id: string; name: string; photoUrl: string; table: number };

export function refuse(refusal: JoinRefusal) {
  const { code, message } = JOIN_REFUSALS[refusal];
  return new ServerError(code, message);
}

function refuseOpenMatch(reconnectionToken?: string) {
  return new ServerError(JOIN_REFUSALS.openMatch.code, openMatchRefusalMessage(reconnectionToken));
}

async function settleOpenMatch(gameApi: GameApi, userId: string, openMatchId: string) {
  const seat = await openMatches.seatOf(userId);
  if (seat?.matchId === openMatchId) {
    throw refuseOpenMatch(seat.reconnectionToken);
  }
  if ((await openMatches.roomOf(openMatchId)) || (await openMatches.startingRoomOf(userId))) {
    throw refuseOpenMatch();
  }
  try {
    await gameApi.finishMatch({ matchId: openMatchId, ...NO_WINNER });
  } catch (error) {
    console.error(`Falha ao encerrar a partida presa ${openMatchId}:`, describeFailure(error));
    throw refuse("apiUnavailable");
  }
}

function isTemporary(error: GameApiError) {
  return error.status === 0 || error.status === 429;
}

function refusalFor(error: unknown): JoinRefusal {
  if (!(error instanceof GameApiError)) {
    return "entryFailed";
  }
  if (error.code === "invalidToken" || error.code === "accountDisabled") {
    return error.code;
  }
  if (error.code === "serviceTokenInvalid" || isTemporary(error) || error.status >= 500) {
    return "apiUnavailable";
  }
  return "entryFailed";
}

function logEntryFailure(error: unknown) {
  const log = error instanceof GameApiError && isTemporary(error) ? console.warn : console.error;
  log("Falha ao consultar o jogador na API:", describeFailure(error));
}

export async function enter(gameApi: GameApi, accessToken: string, table: number | undefined) {
  try {
    return await gameApi.playerEntry({ accessToken, table });
  } catch (error) {
    const refusal = refusalFor(error);
    if (refusal !== "invalidToken" && refusal !== "accountDisabled") {
      logEntryFailure(error);
    }
    throw refuse(refusal);
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
    if (!entry.profileComplete || entry.nickname === null) {
      throw refuse("profileIncomplete");
    }
    if (entry.openMatchId) {
      await settleOpenMatch(gameApi, entry.userId, entry.openMatchId);
    }
    if (entry.canJoin === false) {
      throw refuse("insufficientBalance");
    }
    return { id: entry.userId, name: entry.nickname, photoUrl: entry.photoUrl ?? "", table: chipsTable ?? PRACTICE_TABLE };
  };
}
