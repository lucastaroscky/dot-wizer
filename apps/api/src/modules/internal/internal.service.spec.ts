import assert from "node:assert";
import { fake } from "../../../test/support/fake.ts";
import type { AuthService } from "../auth/auth.service.ts";
import type { MatchesService } from "../matches/matches.service.ts";
import type { ProfileService } from "../profile/profile.service.ts";
import type { WalletService } from "../wallet/wallet.service.ts";
import { InternalService } from "./internal.service.ts";

const userId = "11111111-1111-4111-8111-111111111111";

function buildService({ balance = 5000, complete = true, name = "Ana" as string | null, openMatchId = null as string | null } = {}) {
  const tokens: string[] = [];
  const authService = fake<AuthService>({
    authenticateToken: async ({ token }) => {
      tokens.push(token);
      return { userId, email: "ana@example.com" };
    },
  });
  const profileService = fake<ProfileService>({
    get: async () => ({
      id: userId,
      email: "ana@example.com",
      name,
      birthDate: complete ? "1990-05-20" : null,
      photoUrl: "https://storage.example.com/ana.jpg",
      complete,
    }),
  });
  const walletService = fake<WalletService>({ balanceOf: async () => balance });
  const matchesService = fake<MatchesService>({ openMatchIdOf: async () => openMatchId });
  return { service: new InternalService({ authService, profileService, walletService, matchesService }), tokens };
}

describe("InternalService", () => {
  describe("playerEntry", () => {
    it("identifies the player by the access token and returns name, photo, balance and whether the table is open", async () => {
      const { service, tokens } = buildService({ balance: 5000 });

      const entry = await service.playerEntry({ accessToken: "user-jwt", table: 2 });

      assert.deepStrictEqual(tokens, ["user-jwt"]);
      assert.deepStrictEqual(entry, {
        userId,
        name: "Ana",
        photoUrl: "https://storage.example.com/ana.jpg",
        profileComplete: true,
        balance: 5000,
        minimumBalance: 5000,
        canJoin: true,
        openMatchId: null,
      });
    });

    it("says the player cannot join a table above the balance", async () => {
      const { service } = buildService({ balance: 4999 });

      const entry = await service.playerEntry({ accessToken: "user-jwt", table: 2 });

      assert.strictEqual(entry.canJoin, false);
      assert.strictEqual(entry.minimumBalance, 5000);
    });

    it("reports an incomplete profile without deciding anything about it", async () => {
      const { service } = buildService({ complete: false, name: null });

      const entry = await service.playerEntry({ accessToken: "user-jwt", table: 1 });

      assert.strictEqual(entry.profileComplete, false);
      assert.strictEqual(entry.name, null);
    });

    it("returns the player data without table requirements when no table is given", async () => {
      const { service } = buildService({ balance: 0 });

      const entry = await service.playerEntry({ accessToken: "user-jwt" });

      assert.deepStrictEqual(entry, {
        userId,
        name: "Ana",
        photoUrl: "https://storage.example.com/ana.jpg",
        profileComplete: true,
        balance: 0,
        minimumBalance: null,
        canJoin: null,
        openMatchId: null,
      });
    });

    it("tells which match the player is still in, with or without a table", async () => {
      const matchId = "33333333-3333-4333-8333-333333333333";
      const { service } = buildService({ openMatchId: matchId });

      const withTable = await service.playerEntry({ accessToken: "user-jwt", table: 2 });
      const withoutTable = await service.playerEntry({ accessToken: "user-jwt" });

      assert.strictEqual(withTable.openMatchId, matchId);
      assert.strictEqual(withoutTable.openMatchId, matchId);
      assert.strictEqual(withTable.canJoin, true);
    });

    it("refuses a table that does not exist before looking at the token", async () => {
      const { service, tokens } = buildService();

      await assert.rejects(service.playerEntry({ accessToken: "user-jwt", table: 9 }), {
        statusCode: 422,
        code: "tableNotFound",
      });
      assert.deepStrictEqual(tokens, []);
    });
  });
});
