import type {
  ApiErrorCode,
  EliminatePlayerBody,
  EliminatePlayerResponse,
  FinishMatchBody,
  MatchHistoryResponse,
  PingResponse,
  PlayerEntryBody,
  PlayerEntryResponse,
  RegisterRoundBody,
  RegisterRoundResponse,
  StartMatchBody,
  StartMatchResponse,
} from "@pontinho/api-contract";

export type RegisterRoundInput = RegisterRoundBody & { matchId: string };
export type FinishMatchInput = FinishMatchBody & { matchId: string };
export type EliminatePlayerInput = EliminatePlayerBody & { matchId: string };

export interface GameApi {
  ping(): Promise<PingResponse>;
  playerEntry(body: PlayerEntryBody): Promise<PlayerEntryResponse>;
  startMatch(body: StartMatchBody): Promise<StartMatchResponse>;
  registerRound(input: RegisterRoundInput): Promise<RegisterRoundResponse>;
  finishMatch(input: FinishMatchInput): Promise<MatchHistoryResponse>;
  eliminatePlayer(input: EliminatePlayerInput): Promise<EliminatePlayerResponse>;
}

export type GameApiErrorCode = ApiErrorCode | "networkError" | "timeout" | "invalidResponse";

type GameApiErrorInput = { status: number; code: GameApiErrorCode; call: string; attempt?: number };

export class GameApiError extends Error {
  readonly status: number;
  readonly code: GameApiErrorCode;
  readonly call: string;
  readonly attempt: number;

  constructor({ status, code, call, attempt = 1 }: GameApiErrorInput) {
    super(`${call} falhou com status ${status} e código ${code}`);
    this.status = status;
    this.code = code;
    this.call = call;
    this.attempt = attempt;
  }
}

export function describeFailure(error: unknown) {
  if (error instanceof GameApiError) {
    return { chamada: error.call, status: error.status, codigo: error.code, tentativa: error.attempt };
  }
  return { causa: String(error) };
}
