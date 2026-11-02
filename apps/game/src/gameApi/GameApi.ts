import type {
  EliminatePlayerBody,
  EliminatePlayerResponse,
  FinishMatchBody,
  MatchHistoryResponse,
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
  playerEntry(body: PlayerEntryBody): Promise<PlayerEntryResponse>;
  startMatch(body: StartMatchBody): Promise<StartMatchResponse>;
  registerRound(input: RegisterRoundInput): Promise<RegisterRoundResponse>;
  finishMatch(input: FinishMatchInput): Promise<MatchHistoryResponse>;
  eliminatePlayer(input: EliminatePlayerInput): Promise<EliminatePlayerResponse>;
}

export class GameApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
