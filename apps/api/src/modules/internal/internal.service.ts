import type { PlayerEntryBody, PlayerEntryResponse } from "@pontinho/api-contract";
import type { AuthService } from "../auth/auth.service.ts";
import { findChipTable } from "../matches/find-chip-table.ts";
import type { ProfileService } from "../profile/profile.service.ts";
import type { WalletService } from "../wallet/wallet.service.ts";

interface InternalServiceInput {
  authService: AuthService;
  profileService: ProfileService;
  walletService: WalletService;
}

interface MinimumBalanceInput {
  table: number | undefined;
}

interface CanJoinInput {
  balance: number;
  minimumBalance: number | null;
}

function minimumBalanceOf({ table }: MinimumBalanceInput): number | null {
  if (table === undefined) {
    return null;
  }
  return findChipTable({ table }).minimumBalance;
}

function canJoin({ balance, minimumBalance }: CanJoinInput): boolean | null {
  if (minimumBalance === null) {
    return null;
  }
  return balance >= minimumBalance;
}

export class InternalService {
  private readonly authService: AuthService;
  private readonly profileService: ProfileService;
  private readonly walletService: WalletService;

  constructor({ authService, profileService, walletService }: InternalServiceInput) {
    this.authService = authService;
    this.profileService = profileService;
    this.walletService = walletService;
  }

  async playerEntry({ accessToken, table }: PlayerEntryBody): Promise<PlayerEntryResponse> {
    const minimumBalance = minimumBalanceOf({ table });
    const { userId } = await this.authService.authenticateToken({ token: accessToken });
    const profile = await this.profileService.get({ userId });
    const balance = await this.walletService.balanceOf({ userId });
    return {
      userId,
      name: profile.name,
      photoUrl: profile.photoUrl,
      profileComplete: profile.complete,
      balance,
      minimumBalance,
      canJoin: canJoin({ balance, minimumBalance }),
    };
  }
}
