import assert from "node:assert";
import { fake } from "../../../test/support/fake.ts";
import type { UnitOfWork } from "../../common/database/database-client.ts";
import type { UserRecord, UsersRepository } from "../users/repository/users.repository.ts";
import { HOUSE_ACCOUNT, userAccount } from "../wallet/accounts.ts";
import type { MatchEntrySum, NewWalletEntry, WalletRepository } from "../wallet/repository/wallet.repository.ts";
import { MatchesService } from "./matches.service.ts";
import type { MatchesTransaction } from "./matches.service.ts";
import type { MatchPlayerRecord, MatchRecord, MatchesRepository } from "./repository/matches.repository.ts";

const matchId = "33333333-3333-4333-8333-333333333333";
const ana = "11111111-1111-4111-8111-111111111111";
const bia = "22222222-2222-4222-8222-222222222222";
const caio = "44444444-4444-4444-8444-444444444444";
const stranger = "55555555-5555-4555-8555-555555555555";
const finishedAt = new Date("2026-11-02T18:00:00Z");

function player(userId: string, overrides: Partial<MatchPlayerRecord> = {}): MatchPlayerRecord {
  return { userId, startBalance: 1000, result: 0, deficit: 0, winBonus: 0, finalBalance: null, eliminatedAt: null, ...overrides };
}

function openMatch(overrides: Partial<MatchRecord> = {}): MatchRecord {
  return {
    id: matchId,
    tableId: 2,
    pointValue: 5,
    status: "IN_PROGRESS",
    winnerId: null,
    lastRound: 0,
    startedAt: new Date("2026-11-02T17:00:00Z"),
    finishedAt: null,
    players: [player(ana), player(bia), player(caio)],
    ...overrides,
  };
}

function user(id: string, name: string | null): UserRecord {
  return { id, email: `${id}@example.com`, name, birthDate: null, photoPath: null, active: true };
}

function buildService({
  match = openMatch() as MatchRecord | null,
  balances = {} as Record<string, number>,
  knownUsers = [user(ana, "Ana"), user(bia, "Bia"), user(caio, "Caio")],
  sums = [] as MatchEntrySum[],
  usersInOpenMatches = [] as string[],
} = {}) {
  const entries: NewWalletEntry[] = [];
  const created: unknown[] = [];
  const savedRounds: unknown[] = [];
  const finishes: unknown[] = [];
  const locked: string[][] = [];
  const eliminations: unknown[] = [];

  const matches = fake<MatchesRepository>({
    create: async (input) => {
      created.push(input);
      return openMatch({ players: input.players.map((entry) => player(entry.userId, entry)) });
    },
    eliminate: async (input) => {
      eliminations.push(input);
    },
    findOpenMatchIdOf: async ({ userId }) => (usersInOpenMatches.includes(userId) ? matchId : null),
    findUsersInOpenMatches: async ({ userIds }) => userIds.filter((userId) => usersInOpenMatches.includes(userId)),
    findById: async () => match,
    getById: async () => match as MatchRecord,
    lockAndFind: async () => match,
    saveRound: async (input) => {
      savedRounds.push(input);
      if (match) {
        match = {
          ...match,
          lastRound: input.roundNumber,
          players: match.players.map((current) => {
            const finance = input.finances.find(({ playerId }) => playerId === current.userId);
            return finance ? { ...current, result: finance.result, deficit: finance.deficit } : current;
          }),
        };
      }
    },
    finish: async (input) => {
      finishes.push(input);
    },
  });
  const wallet = fake<WalletRepository>({
    createEntries: async (input) => {
      entries.push(...input.entries);
    },
    balancesOf: async ({ accounts }) =>
      Object.fromEntries(accounts.map((account) => [account, balances[account] ?? 0])),
    sumsByMatch: async () => sums,
  });
  const users = fake<UsersRepository>({
    findByIds: async ({ ids }) => knownUsers.filter(({ id }) => ids.includes(id)),
    lockByIds: async ({ ids }) => {
      locked.push(ids);
    },
  });
  const unitOfWork: UnitOfWork<MatchesTransaction> = { run: (work) => work({ matches, wallet, users }) };
  const service = new MatchesService({
    unitOfWork,
    matchesRepository: matches,
    walletRepository: wallet,
    usersRepository: users,
    now: () => finishedAt,
  });
  return { service, entries, created, savedRounds, finishes, locked, eliminations };
}

describe("MatchesService", () => {
  describe("start", () => {
    const balances = {
      [userAccount({ userId: ana })]: 5000,
      [userAccount({ userId: bia })]: 7000,
      [userAccount({ userId: caio })]: 5000,
    };

    it("stores the starting balance of each player and the point value of the table, charging nothing", async () => {
      const { service, created, entries } = buildService({ balances });

      const started = await service.start({ table: 2, playerIds: [ana, bia, caio] });

      assert.deepStrictEqual(created, [
        {
          tableId: 2,
          pointValue: 5,
          players: [
            { userId: ana, startBalance: 5000 },
            { userId: bia, startBalance: 7000 },
            { userId: caio, startBalance: 5000 },
          ],
        },
      ]);
      assert.deepStrictEqual(entries, []);
      assert.strictEqual(started.matchId, matchId);
      assert.strictEqual(started.pointValue, 5);
      assert.deepStrictEqual(started.players, [
        { userId: ana, startBalance: 5000 },
        { userId: bia, startBalance: 7000 },
        { userId: caio, startBalance: 5000 },
      ]);
    });

    it("locks the players in id order before checking and creating the match", async () => {
      const { service, locked } = buildService({ balances });

      await service.start({ table: 2, playerIds: [caio, ana, bia] });

      assert.deepStrictEqual(locked, [[ana, bia, caio]]);
    });

    it("refuses a player who is still in a match that was not finished", async () => {
      const { service, created } = buildService({ balances, usersInOpenMatches: [bia] });

      await assert.rejects(service.start({ table: 2, playerIds: [ana, bia, caio] }), {
        statusCode: 409,
        code: "playerAlreadyInMatch",
      });
      assert.deepStrictEqual(created, []);
    });

    it("refuses a table that does not exist", async () => {
      const { service } = buildService({ balances });

      await assert.rejects(service.start({ table: 8, playerIds: [ana, bia, caio] }), {
        statusCode: 422,
        code: "tableNotFound",
      });
    });

    it("refuses a player the API does not know", async () => {
      const { service, created } = buildService({ balances, knownUsers: [user(ana, "Ana"), user(bia, "Bia")] });

      await assert.rejects(service.start({ table: 2, playerIds: [ana, bia, caio] }), {
        statusCode: 404,
        code: "playerNotFound",
      });
      assert.deepStrictEqual(created, []);
    });

    it("refuses when a player does not have the minimum balance of the table", async () => {
      const poor = { ...balances, [userAccount({ userId: bia })]: 4999 };
      const { service, created } = buildService({ balances: poor });

      await assert.rejects(service.start({ table: 2, playerIds: [ana, bia, caio] }), {
        statusCode: 409,
        code: "playerBelowMinimumBalance",
      });
      assert.deepStrictEqual(created, []);
    });
  });

  describe("registerRound", () => {
    const roundBalances = {
      [userAccount({ userId: ana })]: 1000,
      [userAccount({ userId: bia })]: 950,
      [userAccount({ userId: caio })]: 900,
    };

    it("charges each loser hand points times the point value and credits the winner", async () => {
      const { service, entries, savedRounds, locked } = buildService({ balances: roundBalances });

      const result = await service.registerRound({
        matchId,
        roundNumber: 1,
        winnerId: ana,
        losers: [
          { userId: bia, handPoints: 10 },
          { userId: caio, handPoints: 20 },
        ],
      });

      assert.deepStrictEqual(
        entries.map(({ fromAccount, toAccount, amount, type, idempotencyKey }) => ({ fromAccount, toAccount, amount, type, idempotencyKey })),
        [
          { fromAccount: userAccount({ userId: bia }), toAccount: userAccount({ userId: ana }), amount: 50, type: "ROUND_PAYMENT", idempotencyKey: `match:${matchId}:round:1:payment:${bia}` },
          { fromAccount: userAccount({ userId: caio }), toAccount: userAccount({ userId: ana }), amount: 100, type: "ROUND_PAYMENT", idempotencyKey: `match:${matchId}:round:1:payment:${caio}` },
        ],
      );
      assert.deepStrictEqual(locked, [[bia, caio]]);
      assert.strictEqual(savedRounds.length, 1);
      assert.strictEqual(result.lastRound, 1);
      assert.deepStrictEqual(result.players, [
        { userId: ana, startBalance: 1000, result: 150, deficit: 0, balance: 1000 },
        { userId: bia, startBalance: 1000, result: -50, deficit: 0, balance: 950 },
        { userId: caio, startBalance: 1000, result: -100, deficit: 0, balance: 900 },
      ]);
    });

    it("records a deficit when a loser cannot pay everything and charges only what the loser has", async () => {
      const match = openMatch({ players: [player(ana), player(bia, { startBalance: 30 }), player(caio)] });
      const { service, entries, savedRounds } = buildService({ match });

      await service.registerRound({
        matchId,
        roundNumber: 1,
        winnerId: ana,
        losers: [{ userId: bia, handPoints: 10 }],
      });

      assert.deepStrictEqual(entries.map(({ amount }) => amount), [30]);
      assert.deepStrictEqual(savedRounds, [
        {
          matchId,
          roundNumber: 1,
          finances: [
            { playerId: ana, startBalance: 1000, result: 30, deficit: 0 },
            { playerId: bia, startBalance: 30, result: -30, deficit: 20 },
            { playerId: caio, startBalance: 1000, result: 0, deficit: 0 },
          ],
        },
      ]);
    });

    it("sends to the house the part of the winner's gain that clears the winner's deficit", async () => {
      const match = openMatch({
        lastRound: 1,
        players: [player(ana, { startBalance: 10, result: -10, deficit: 40 }), player(bia), player(caio)],
      });
      const { service, entries } = buildService({ match });

      await service.registerRound({
        matchId,
        roundNumber: 2,
        winnerId: ana,
        losers: [{ userId: bia, handPoints: 20 }],
      });

      assert.deepStrictEqual(
        entries.map(({ fromAccount, toAccount, amount, type }) => ({ fromAccount, toAccount, amount, type })),
        [
          { fromAccount: userAccount({ userId: bia }), toAccount: userAccount({ userId: ana }), amount: 100, type: "ROUND_PAYMENT" },
          { fromAccount: userAccount({ userId: ana }), toAccount: HOUSE_ACCOUNT, amount: 40, type: "DEFICIT_OFFSET" },
        ],
      );
    });

    it("does not charge again when the same round is sent twice", async () => {
      const { service, entries, savedRounds } = buildService({ match: openMatch({ lastRound: 3 }), balances: roundBalances });

      const result = await service.registerRound({
        matchId,
        roundNumber: 3,
        winnerId: ana,
        losers: [{ userId: bia, handPoints: 10 }],
      });

      assert.deepStrictEqual(entries, []);
      assert.deepStrictEqual(savedRounds, []);
      assert.strictEqual(result.lastRound, 3);
      assert.strictEqual(result.players.length, 3);
    });

    it("refuses a round that skips ahead", async () => {
      const { service, entries } = buildService();

      await assert.rejects(
        service.registerRound({ matchId, roundNumber: 3, winnerId: ana, losers: [{ userId: bia, handPoints: 10 }] }),
        { statusCode: 409, code: "roundOutOfOrder" },
      );
      assert.deepStrictEqual(entries, []);
    });

    it("answers 404 for an unknown match", async () => {
      const { service } = buildService({ match: null });

      await assert.rejects(
        service.registerRound({ matchId, roundNumber: 1, winnerId: ana, losers: [{ userId: bia, handPoints: 10 }] }),
        { statusCode: 404, code: "matchNotFound" },
      );
    });

    it("refuses a round on a finished match", async () => {
      const { service } = buildService({ match: openMatch({ status: "FINISHED" }) });

      await assert.rejects(
        service.registerRound({ matchId, roundNumber: 1, winnerId: ana, losers: [{ userId: bia, handPoints: 10 }] }),
        { statusCode: 409, code: "matchAlreadyFinished" },
      );
    });

    it("refuses a winner or a loser that is not in the match", async () => {
      const { service, entries } = buildService();

      await assert.rejects(
        service.registerRound({ matchId, roundNumber: 1, winnerId: stranger, losers: [{ userId: bia, handPoints: 10 }] }),
        { statusCode: 422, code: "playerNotInMatch" },
      );
      await assert.rejects(
        service.registerRound({ matchId, roundNumber: 1, winnerId: ana, losers: [{ userId: stranger, handPoints: 10 }] }),
        { statusCode: 422, code: "playerNotInMatch" },
      );
      assert.deepStrictEqual(entries, []);
    });
  });

  describe("finish", () => {
    const finalBalances = {
      [userAccount({ userId: ana })]: 1200,
      [userAccount({ userId: bia })]: 900,
      [userAccount({ userId: caio })]: 850,
    };

    it("credits the win bonus from the house, ten times the point value, and closes the match", async () => {
      const { service, entries, finishes } = buildService({ balances: finalBalances });

      await service.finish({ matchId, winnerId: ana, awardWinBonus: true });

      assert.deepStrictEqual(entries, [
        {
          fromAccount: HOUSE_ACCOUNT,
          toAccount: userAccount({ userId: ana }),
          amount: 50,
          type: "WIN_BONUS",
          idempotencyKey: `match:${matchId}:win-bonus`,
          matchId,
        },
      ]);
      assert.deepStrictEqual(finishes, [
        {
          matchId,
          winnerId: ana,
          finishedAt,
          players: [
            { userId: ana, winBonus: 50, finalBalance: 1200 },
            { userId: bia, winBonus: 0, finalBalance: 900 },
            { userId: caio, winBonus: 0, finalBalance: 850 },
          ],
        },
      ]);
    });

    it("refuses a winner who was eliminated, without paying or closing anything", async () => {
      const match = openMatch({
        players: [player(ana), player(bia, { eliminatedAt: new Date("2026-11-02T17:30:00Z"), finalBalance: 700 }), player(caio)],
      });
      const { service, entries, finishes } = buildService({ match, balances: finalBalances });

      await assert.rejects(service.finish({ matchId, winnerId: bia, awardWinBonus: true }), {
        statusCode: 422,
        code: "winnerEliminated",
      });
      assert.deepStrictEqual(entries, []);
      assert.deepStrictEqual(finishes, []);
    });

    it("closes the match without any bonus when nobody won", async () => {
      const { service, entries, finishes } = buildService({ balances: finalBalances });

      await service.finish({ matchId, winnerId: null, awardWinBonus: false });

      assert.deepStrictEqual(entries, []);
      assert.strictEqual(finishes.length, 1);
    });

    it("refuses a winner that is not in the match", async () => {
      const { service, entries, finishes } = buildService();

      await assert.rejects(service.finish({ matchId, winnerId: stranger, awardWinBonus: true }), {
        statusCode: 422,
        code: "playerNotInMatch",
      });
      assert.deepStrictEqual(entries, []);
      assert.deepStrictEqual(finishes, []);
    });

    it("records the winner without paying the bonus when the winner is not entitled to it", async () => {
      const { service, entries, finishes } = buildService({ balances: finalBalances });

      await service.finish({ matchId, winnerId: ana, awardWinBonus: false });

      assert.deepStrictEqual(entries, []);
      assert.deepStrictEqual(finishes, [
        {
          matchId,
          winnerId: ana,
          finishedAt,
          players: [
            { userId: ana, winBonus: 0, finalBalance: 1200 },
            { userId: bia, winBonus: 0, finalBalance: 900 },
            { userId: caio, winBonus: 0, finalBalance: 850 },
          ],
        },
      ]);
    });

    it("repeats a finish without bonus without paying it later", async () => {
      const finished = openMatch({ status: "FINISHED", winnerId: ana });
      const { service, entries, finishes } = buildService({ match: finished });

      const history = await service.finish({ matchId, winnerId: ana, awardWinBonus: false });

      assert.deepStrictEqual(entries, []);
      assert.deepStrictEqual(finishes, []);
      assert.strictEqual(history.winnerId, ana);
    });

    it("does not recalculate the final balance of a player who was eliminated", async () => {
      const match = openMatch({
        players: [player(ana), player(bia, { eliminatedAt: new Date("2026-11-02T17:30:00Z"), finalBalance: 700 }), player(caio)],
      });
      const { service, finishes } = buildService({ match, balances: finalBalances });

      await service.finish({ matchId, winnerId: ana, awardWinBonus: true });

      assert.deepStrictEqual(finishes, [
        {
          matchId,
          winnerId: ana,
          finishedAt,
          players: [
            { userId: ana, winBonus: 50, finalBalance: 1200 },
            { userId: bia, winBonus: 0, finalBalance: undefined },
            { userId: caio, winBonus: 0, finalBalance: 850 },
          ],
        },
      ]);
    });

    it("refuses to repeat a finish with a different decision about the bonus", async () => {
      const withBonus = openMatch({ status: "FINISHED", winnerId: ana, players: [player(ana, { winBonus: 50 }), player(bia), player(caio)] });
      const withoutBonus = openMatch({ status: "FINISHED", winnerId: ana });

      await assert.rejects(
        buildService({ match: withBonus }).service.finish({ matchId, winnerId: ana, awardWinBonus: false }),
        { statusCode: 409, code: "winnerChanged" },
      );
      await assert.rejects(
        buildService({ match: withoutBonus }).service.finish({ matchId, winnerId: ana, awardWinBonus: true }),
        { statusCode: 409, code: "winnerChanged" },
      );
    });

    it("does not pay the bonus twice when the match is finished again with the same winner", async () => {
      const finished = openMatch({
        status: "FINISHED",
        winnerId: ana,
        players: [player(ana, { winBonus: 50 }), player(bia), player(caio)],
      });
      const { service, entries, finishes } = buildService({ match: finished });

      const history = await service.finish({ matchId, winnerId: ana, awardWinBonus: true });

      assert.deepStrictEqual(entries, []);
      assert.deepStrictEqual(finishes, []);
      assert.strictEqual(history.status, "FINISHED");
    });

    it("refuses to finish a closed match with another result", async () => {
      const finished = openMatch({ status: "FINISHED", winnerId: ana });
      const { service } = buildService({ match: finished });

      await assert.rejects(service.finish({ matchId, winnerId: bia, awardWinBonus: true }), {
        statusCode: 409,
        code: "winnerChanged",
      });
    });

    it("answers 404 for an unknown match", async () => {
      const { service } = buildService({ match: null });

      await assert.rejects(service.finish({ matchId, winnerId: ana, awardWinBonus: true }), { statusCode: 404 });
    });
  });

  describe("eliminate", () => {
    it("records when the player was eliminated and the balance the player had then", async () => {
      const { service, eliminations } = buildService({ balances: { [userAccount({ userId: bia })]: 980 } });

      const result = await service.eliminate({ matchId, userId: bia });

      assert.deepStrictEqual(eliminations, [{ matchId, userId: bia, eliminatedAt: finishedAt, finalBalance: 980 }]);
      assert.deepStrictEqual(result, { matchId, userId: bia, eliminatedAt: finishedAt.toISOString() });
    });

    it("keeps the first elimination date when the same player is eliminated again", async () => {
      const earlier = new Date("2026-11-02T17:30:00Z");
      const match = openMatch({ players: [player(ana), player(bia, { eliminatedAt: earlier }), player(caio)] });
      const { service, eliminations } = buildService({ match });

      const result = await service.eliminate({ matchId, userId: bia });

      assert.deepStrictEqual(eliminations, []);
      assert.strictEqual(result.eliminatedAt, earlier.toISOString());
    });

    it("refuses a player that is not in the match", async () => {
      const { service, eliminations } = buildService();

      await assert.rejects(service.eliminate({ matchId, userId: stranger }), {
        statusCode: 422,
        code: "playerNotInMatch",
      });
      assert.deepStrictEqual(eliminations, []);
    });

    it("refuses an elimination in a match that was already finished", async () => {
      const { service, eliminations } = buildService({ match: openMatch({ status: "FINISHED" }) });

      await assert.rejects(service.eliminate({ matchId, userId: bia }), {
        statusCode: 409,
        code: "matchAlreadyFinished",
      });
      assert.deepStrictEqual(eliminations, []);
    });

    it("answers 404 for an unknown match", async () => {
      const { service } = buildService({ match: null });

      await assert.rejects(service.eliminate({ matchId, userId: bia }), {
        statusCode: 404,
        code: "matchNotFound",
      });
    });
  });

  describe("openMatchIdOf", () => {
    it("returns the id of the match the user is in without finishing it", async () => {
      const { service } = buildService({ usersInOpenMatches: [ana] });

      assert.strictEqual(await service.openMatchIdOf({ userId: ana }), matchId);
    });

    it("returns null when the user has no open match", async () => {
      const { service } = buildService();

      assert.strictEqual(await service.openMatchIdOf({ userId: ana }), null);
    });
  });

  describe("getHistory", () => {
    it("returns the match with the money summary of every player to someone who played it", async () => {
      const { service } = buildService({
        match: openMatch({ status: "FINISHED", winnerId: ana, finishedAt }),
        sums: [
          { type: "ROUND_PAYMENT", fromAccount: userAccount({ userId: bia }), toAccount: userAccount({ userId: ana }), amount: 50 },
        ],
      });

      const history = await service.getHistory({ userId: bia, matchId });

      assert.strictEqual(history.id, matchId);
      assert.strictEqual(history.table, 2);
      assert.strictEqual(history.winnerId, ana);
      assert.strictEqual(history.finishedAt, finishedAt.toISOString());
      assert.deepStrictEqual(history.players.map(({ userId, name, paid, received }) => ({ userId, name, paid, received })), [
        { userId: ana, name: "Ana", paid: 0, received: 50 },
        { userId: bia, name: "Bia", paid: 50, received: 0 },
        { userId: caio, name: "Caio", paid: 0, received: 0 },
      ]);
    });

    it("answers 404 to someone who did not play the match, without telling it exists", async () => {
      const { service } = buildService();

      await assert.rejects(service.getHistory({ userId: stranger, matchId }), {
        statusCode: 404,
        code: "matchNotFound",
      });
    });

    it("answers 404 for an unknown match", async () => {
      const { service } = buildService({ match: null });

      await assert.rejects(service.getHistory({ userId: ana, matchId }), { statusCode: 404 });
    });
  });
});
