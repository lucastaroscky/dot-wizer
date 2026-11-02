import assert from "node:assert";
import { randomUUID } from "node:crypto";
import errors from "../../common/messages/errors.json" with { type: "json" };
import { allBalances, ledgerBalance, seedUser } from "../../../test/support/seed.ts";
import { createTestApp } from "../../../test/support/test-app.ts";
import type { TestApp } from "../../../test/support/test-app.ts";
import { testPrisma } from "../../../test/support/test-database.ts";
import { HOUSE_ACCOUNT, userAccount } from "../wallet/accounts.ts";

describe("internal routes", () => {
  let testApp: TestApp;

  before(async () => {
    testApp = await createTestApp();
  });
  after(async () => testApp.app.close());
  beforeEach(async () => testApp.reset());

  function post(url: string, payload: unknown) {
    return testApp.app.inject({ method: "POST", url, headers: testApp.serviceHeaders, payload: payload as object });
  }

  async function startMatch({ table = 1, balances = [5000, 5000, 5000] } = {}) {
    const playerIds = [];
    for (const balance of balances) {
      playerIds.push(await seedUser({ balance, name: `Jogador ${playerIds.length + 1}` }));
    }
    const response = await post("/internal/matches", { table, playerIds });
    return { playerIds, response, matchId: response.json().matchId as string };
  }

  async function signInAs(userId: string) {
    const { headers } = await testApp.signIn({ userId });
    return headers.authorization.replace("Bearer ", "");
  }

  function round(matchId: string, body: unknown) {
    return post(`/internal/matches/${matchId}/rounds`, body);
  }

  describe("service secret", () => {
    it("rejects a call without the service token", async () => {
      const response = await testApp.app.inject({ method: "POST", url: "/internal/matches", payload: {} });

      assert.strictEqual(response.statusCode, 401);
      assert.strictEqual(response.json().message, errors.auth.invalidServiceToken);
    });

    it("rejects a wrong service token", async () => {
      const response = await testApp.app.inject({
        method: "POST",
        url: "/internal/matches",
        headers: { "x-service-token": "x".repeat(40) },
        payload: {},
      });

      assert.strictEqual(response.statusCode, 401);
    });

    it("does not accept a player's access token on an internal route", async () => {
      const { headers } = await testApp.signIn();

      const response = await testApp.app.inject({ method: "POST", url: "/internal/matches", headers, payload: {} });

      assert.strictEqual(response.statusCode, 401);
    });

    it("does not accept the service token on a player route", async () => {
      const response = await testApp.app.inject({ method: "GET", url: "/wallet", headers: testApp.serviceHeaders });

      assert.strictEqual(response.statusCode, 401);
    });
  });

  describe("player entry", () => {
    it("returns name, photo, balance and whether the player can join the table", async () => {
      const { userId, headers } = await testApp.signIn();
      const accessToken = headers.authorization.replace("Bearer ", "");
      await testApp.app.inject({
        method: "PUT",
        url: "/profile",
        headers,
        payload: { name: "Ana", birthDate: "1990-05-20" },
      });
      await testApp.app.inject({ method: "POST", url: "/store/purchases", headers, payload: { quantity: 5000 } });

      const table2 = await post("/internal/players/entry", { accessToken, table: 2 });
      const table3 = await post("/internal/players/entry", { accessToken, table: 3 });

      assert.strictEqual(table2.statusCode, 200);
      assert.deepStrictEqual(table2.json(), {
        userId,
        name: "Ana",
        photoUrl: null,
        profileComplete: true,
        balance: 5000,
        minimumBalance: 5000,
        canJoin: true,
        openMatchId: null,
      });
      assert.strictEqual(table3.json().canJoin, false);
      assert.strictEqual(table3.json().minimumBalance, 10_000);
    });

    it("returns the name and photo without table requirements for a practice match", async () => {
      const { userId, headers } = await testApp.signIn();
      const accessToken = headers.authorization.replace("Bearer ", "");
      await testApp.app.inject({
        method: "PUT",
        url: "/profile",
        headers,
        payload: { name: "Ana", birthDate: "1990-05-20" },
      });

      const response = await post("/internal/players/entry", { accessToken });

      assert.strictEqual(response.statusCode, 200);
      assert.deepStrictEqual(response.json(), {
        userId,
        name: "Ana",
        photoUrl: null,
        profileComplete: true,
        balance: 0,
        minimumBalance: null,
        canJoin: null,
        openMatchId: null,
      });
    });

    it("tells which match the player is in until it is finished, without refusing the entry", async () => {
      const { playerIds: [ana], matchId } = await startMatch({ table: 1, balances: [5000, 5000, 5000] });
      const token = await signInAs(ana);

      const withTable = await post("/internal/players/entry", { accessToken: token, table: 1 });
      const withoutTable = await post("/internal/players/entry", { accessToken: token });
      await post(`/internal/matches/${matchId}/finish`, { winnerId: null, awardWinBonus: false });
      const afterFinish = await post("/internal/players/entry", { accessToken: token, table: 1 });

      assert.strictEqual(withTable.statusCode, 200);
      assert.strictEqual(withTable.json().openMatchId, matchId);
      assert.strictEqual(withTable.json().canJoin, true);
      assert.strictEqual(withoutTable.json().openMatchId, matchId);
      assert.strictEqual(afterFinish.json().openMatchId, null);
    });

    it("rejects an invalid access token", async () => {
      const response = await post("/internal/players/entry", { accessToken: "garbage", table: 1 });

      assert.strictEqual(response.statusCode, 401);
      assert.strictEqual(response.json().message, errors.auth.invalidToken);
    });

    it("rejects a table that does not exist", async () => {
      const { headers } = await testApp.signIn();

      const response = await post("/internal/players/entry", {
        accessToken: headers.authorization.replace("Bearer ", ""),
        table: 8,
      });

      assert.strictEqual(response.statusCode, 422);
    });
  });

  describe("start match", () => {
    it("stores the starting balances and charges nothing", async () => {
      const { playerIds, response } = await startMatch({ table: 2, balances: [5000, 7000, 9000] });

      assert.strictEqual(response.statusCode, 201);
      const body = response.json();
      assert.strictEqual(body.table, 2);
      assert.strictEqual(body.pointValue, 5);
      assert.deepStrictEqual(
        body.players.map(({ userId, startBalance }: { userId: string; startBalance: number }) => [userId, startBalance]).sort(),
        [[playerIds[0], 5000], [playerIds[1], 7000], [playerIds[2], 9000]].sort(),
      );
      assert.strictEqual(await ledgerBalance({ account: userAccount({ userId: playerIds[1] }) }), 7000);
      assert.strictEqual(await testPrisma.walletEntry.count(), 3);
    });

    it("refuses when someone does not have the minimum balance of the table", async () => {
      const { response, matchId } = await startMatch({ table: 2, balances: [5000, 4999, 5000] });

      assert.strictEqual(response.statusCode, 409);
      assert.strictEqual(response.json().message, errors.matches.playerBelowMinimumBalance);
      assert.strictEqual(matchId, undefined);
      assert.strictEqual(await testPrisma.match.count(), 0);
    });

    it("refuses a player who is already in a match that was not finished", async () => {
      const { playerIds: [ana, bia, caio], matchId } = await startMatch({ balances: [5000, 5000, 5000] });
      const [dani, edu] = [await seedUser({ balance: 5000 }), await seedUser({ balance: 5000 })];

      const second = await post("/internal/matches", { table: 1, playerIds: [dani, edu, caio] });

      assert.strictEqual(second.statusCode, 409);
      assert.strictEqual(second.json().message, errors.matches.playerAlreadyInMatch);
      assert.strictEqual(await testPrisma.match.count(), 1);
      assert.deepStrictEqual(
        (await testPrisma.matchPlayer.findMany({ where: { matchId }, select: { userId: true } })).map(({ userId }) => userId).sort(),
        [ana, bia, caio].sort(),
      );
    });

    it("frees the players when the match is finished", async () => {
      const { playerIds, matchId } = await startMatch({ balances: [5000, 5000, 5000] });

      await post(`/internal/matches/${matchId}/finish`, { winnerId: null, awardWinBonus: false });
      const next = await post("/internal/matches", { table: 1, playerIds });

      assert.strictEqual(next.statusCode, 201);
    });

    it("lets only one of two matches that start at the same time with the same player", async () => {
      const [shared, a1, a2, b1, b2] = [
        await seedUser({ balance: 5000 }),
        await seedUser({ balance: 5000 }),
        await seedUser({ balance: 5000 }),
        await seedUser({ balance: 5000 }),
        await seedUser({ balance: 5000 }),
      ];

      const responses = await Promise.all([
        post("/internal/matches", { table: 1, playerIds: [shared, a1, a2] }),
        post("/internal/matches", { table: 1, playerIds: [shared, b1, b2] }),
      ]);

      assert.deepStrictEqual(responses.map(({ statusCode }) => statusCode).sort(), [201, 409]);
      assert.strictEqual(await testPrisma.match.count(), 1);
    });

    it("refuses an unknown player, a repeated player and a wrong number of players", async () => {
      const [a, b, c] = [await seedUser({ balance: 5000 }), await seedUser({ balance: 5000 }), await seedUser({ balance: 5000 })];

      const unknown = await post("/internal/matches", { table: 1, playerIds: [a, b, randomUUID()] });
      const repeated = await post("/internal/matches", { table: 1, playerIds: [a, b, b] });
      const tooFew = await post("/internal/matches", { table: 1, playerIds: [a, b] });
      const tooMany = await post("/internal/matches", { table: 1, playerIds: [a, b, c, randomUUID(), randomUUID()] });

      assert.deepStrictEqual([unknown.statusCode, repeated.statusCode, tooFew.statusCode, tooMany.statusCode], [404, 400, 400, 400]);
    });
  });

  describe("register round", () => {
    it("moves the chips of the round and returns the financial state of every player", async () => {
      const { playerIds: [ana, bia, caio], matchId } = await startMatch({ table: 2 });

      const response = await round(matchId, {
        roundNumber: 1,
        winnerId: ana,
        losers: [{ userId: bia, handPoints: 10 }, { userId: caio, handPoints: 20 }],
      });

      assert.strictEqual(response.statusCode, 200);
      const byUser = Object.fromEntries(response.json().players.map((player: { userId: string }) => [player.userId, player]));
      assert.deepStrictEqual(byUser[ana], { userId: ana, startBalance: 5000, result: 150, deficit: 0, balance: 5150 });
      assert.deepStrictEqual(byUser[bia], { userId: bia, startBalance: 5000, result: -50, deficit: 0, balance: 4950 });
      assert.deepStrictEqual(byUser[caio], { userId: caio, startBalance: 5000, result: -100, deficit: 0, balance: 4900 });
      assert.strictEqual(response.json().lastRound, 1);
    });

    it("does not charge twice when the same round is sent again", async () => {
      const { playerIds: [ana, bia, caio], matchId } = await startMatch({ table: 2 });
      const body = { roundNumber: 1, winnerId: ana, losers: [{ userId: bia, handPoints: 10 }] };

      const first = await round(matchId, body);
      const second = await round(matchId, body);

      assert.strictEqual(second.statusCode, 200);
      assert.deepStrictEqual(second.json(), first.json());
      assert.strictEqual(await ledgerBalance({ account: userAccount({ userId: bia }) }), 4950);
      assert.strictEqual(await ledgerBalance({ account: userAccount({ userId: caio }) }), 5000);
      assert.strictEqual(await testPrisma.walletEntry.count({ where: { type: "ROUND_PAYMENT" } }), 1);
    });

    it("charges once when the same round arrives twice at the same time", async () => {
      const { playerIds: [ana, bia], matchId } = await startMatch({ table: 2 });
      const body = { roundNumber: 1, winnerId: ana, losers: [{ userId: bia, handPoints: 10 }] };

      const responses = await Promise.all([round(matchId, body), round(matchId, body), round(matchId, body)]);

      assert.deepStrictEqual(responses.map(({ statusCode }) => statusCode), [200, 200, 200]);
      assert.strictEqual(await ledgerBalance({ account: userAccount({ userId: bia }) }), 4950);
      assert.strictEqual(await testPrisma.walletEntry.count({ where: { type: "ROUND_PAYMENT" } }), 1);
    });

    it("charges only what the loser has and carries the rest as deficit, cleared from the next gains", async () => {
      const { playerIds: [ana, bia, caio], matchId } = await startMatch({ table: 1, balances: [1000, 1000, 1000] });

      const first = await round(matchId, { roundNumber: 1, winnerId: ana, losers: [{ userId: bia, handPoints: 1500 }] });
      const second = await round(matchId, { roundNumber: 2, winnerId: bia, losers: [{ userId: caio, handPoints: 300 }] });

      const afterFirst = Object.fromEntries(first.json().players.map((player: { userId: string }) => [player.userId, player]));
      assert.deepStrictEqual(afterFirst[bia], { userId: bia, startBalance: 1000, result: -1000, deficit: 500, balance: 0 });
      const afterSecond = Object.fromEntries(second.json().players.map((player: { userId: string }) => [player.userId, player]));
      assert.deepStrictEqual(afterSecond[bia], { userId: bia, startBalance: 1000, result: -1000, deficit: 200, balance: 0 });
      assert.strictEqual(await ledgerBalance({ account: HOUSE_ACCOUNT }), -3000 + 300);
      assert.strictEqual(await ledgerBalance({ account: userAccount({ userId: bia }) }), 0);
      assert.strictEqual(await ledgerBalance({ account: userAccount({ userId: caio }) }), 700);
    });

    it("keeps every balance non-negative and the books balanced after many rounds", async () => {
      const { playerIds: [ana, bia, caio], matchId } = await startMatch({ table: 1, balances: [1000, 1000, 1000] });
      const rounds = [
        { winnerId: ana, losers: [{ userId: bia, handPoints: 400 }, { userId: caio, handPoints: 700 }] },
        { winnerId: bia, losers: [{ userId: ana, handPoints: 900 }, { userId: caio, handPoints: 900 }] },
        { winnerId: caio, losers: [{ userId: ana, handPoints: 100 }, { userId: bia, handPoints: 1200 }] },
        { winnerId: ana, losers: [{ userId: bia, handPoints: 300 }] },
      ];

      for (const [index, current] of rounds.entries()) {
        const response = await round(matchId, { roundNumber: index + 1, ...current });
        assert.strictEqual(response.statusCode, 200);
      }

      const balances = await allBalances();
      for (const userId of [ana, bia, caio]) {
        assert.ok(balances[userAccount({ userId })] >= 0, `user ${userId} went negative`);
      }
      const total = Object.values(balances).reduce((sum, value) => sum + value, 0);
      assert.strictEqual(total, 0);
    });

    it("refuses a round that skips ahead and one that comes after the match ended", async () => {
      const { playerIds: [ana, bia], matchId } = await startMatch({ table: 2 });
      const body = { winnerId: ana, losers: [{ userId: bia, handPoints: 10 }] };

      const skipped = await round(matchId, { roundNumber: 2, ...body });
      await post(`/internal/matches/${matchId}/finish`, { winnerId: null, awardWinBonus: false });
      const late = await round(matchId, { roundNumber: 1, ...body });

      assert.strictEqual(skipped.statusCode, 409);
      assert.strictEqual(skipped.json().message, errors.matches.roundOutOfOrder);
      assert.strictEqual(late.statusCode, 409);
      assert.strictEqual(late.json().message, errors.matches.alreadyFinished);
    });

    it("refuses players that are not in the match and invalid bodies", async () => {
      const { playerIds: [ana, bia], matchId } = await startMatch({ table: 2 });

      const stranger = await round(matchId, { roundNumber: 1, winnerId: ana, losers: [{ userId: randomUUID(), handPoints: 10 }] });
      const winnerAsLoser = await round(matchId, { roundNumber: 1, winnerId: ana, losers: [{ userId: ana, handPoints: 10 }] });
      const negative = await round(matchId, { roundNumber: 1, winnerId: ana, losers: [{ userId: bia, handPoints: -5 }] });
      const unknownMatch = await round(randomUUID(), { roundNumber: 1, winnerId: ana, losers: [{ userId: bia, handPoints: 10 }] });

      assert.deepStrictEqual(
        [stranger.statusCode, winnerAsLoser.statusCode, negative.statusCode, unknownMatch.statusCode],
        [422, 400, 400, 404],
      );
      assert.strictEqual(await testPrisma.walletEntry.count({ where: { type: "ROUND_PAYMENT" } }), 0);
    });

    it("never lets a balance go negative when chips leave the wallet during the match", async () => {
      const { playerIds: [ana, bia], matchId } = await startMatch({ table: 1, balances: [1000, 1000, 1000] });
      await testPrisma.walletEntry.create({
        data: {
          fromAccount: userAccount({ userId: bia }),
          toAccount: HOUSE_ACCOUNT,
          amount: 600,
          type: "DEFICIT_OFFSET",
          idempotencyKey: "chips-left-the-wallet",
        },
      });

      const response = await round(matchId, { roundNumber: 1, winnerId: ana, losers: [{ userId: bia, handPoints: 1000 }] });

      assert.strictEqual(response.statusCode, 409);
      assert.strictEqual(response.json().message, errors.wallet.insufficientBalance);
      assert.strictEqual(await ledgerBalance({ account: userAccount({ userId: bia }) }), 400);
      assert.strictEqual((await testPrisma.match.findUniqueOrThrow({ where: { id: matchId } })).lastRound, 0);
    });
  });

  describe("finish match", () => {
    it("pays the win bonus from the house, ten times the point value, and returns the history", async () => {
      const { playerIds: [ana, bia], matchId } = await startMatch({ table: 2 });
      await round(matchId, { roundNumber: 1, winnerId: ana, losers: [{ userId: bia, handPoints: 10 }] });

      const response = await post(`/internal/matches/${matchId}/finish`, { winnerId: ana, awardWinBonus: true });

      assert.strictEqual(response.statusCode, 200);
      const history = response.json();
      assert.strictEqual(history.status, "FINISHED");
      assert.strictEqual(history.winnerId, ana);
      const winner = history.players.find((player: { userId: string }) => player.userId === ana);
      assert.deepStrictEqual(winner, {
        userId: ana,
        name: "Jogador 1",
        startBalance: 5000,
        paid: 0,
        received: 50,
        deficitCleared: 0,
        deficit: 0,
        winBonus: 50,
        result: 50,
        finalBalance: 5100,
      });
      assert.strictEqual(await ledgerBalance({ account: userAccount({ userId: ana }) }), 5100);
    });

    it("pays the bonus only once when the match is finished twice", async () => {
      const { playerIds: [ana], matchId } = await startMatch({ table: 2 });

      await post(`/internal/matches/${matchId}/finish`, { winnerId: ana, awardWinBonus: true });
      const again = await post(`/internal/matches/${matchId}/finish`, { winnerId: ana, awardWinBonus: true });
      const different = await post(`/internal/matches/${matchId}/finish`, { winnerId: null, awardWinBonus: false });

      assert.strictEqual(again.statusCode, 200);
      assert.strictEqual(different.statusCode, 409);
      assert.strictEqual(await testPrisma.walletEntry.count({ where: { type: "WIN_BONUS" } }), 1);
    });

    it("pays the bonus once when two finishes arrive at the same time", async () => {
      const { playerIds: [ana], matchId } = await startMatch({ table: 2 });

      const responses = await Promise.all([
        post(`/internal/matches/${matchId}/finish`, { winnerId: ana, awardWinBonus: true }),
        post(`/internal/matches/${matchId}/finish`, { winnerId: ana, awardWinBonus: true }),
      ]);

      assert.deepStrictEqual(responses.map(({ statusCode }) => statusCode), [200, 200]);
      assert.strictEqual(await testPrisma.walletEntry.count({ where: { type: "WIN_BONUS" } }), 1);
    });

    it("records the winner without paying the bonus when awardWinBonus is false", async () => {
      const { playerIds: [ana], matchId } = await startMatch({ table: 2 });

      const response = await post(`/internal/matches/${matchId}/finish`, { winnerId: ana, awardWinBonus: false });

      assert.strictEqual(response.statusCode, 200);
      const history = response.json();
      assert.strictEqual(history.winnerId, ana);
      assert.strictEqual(history.status, "FINISHED");
      const winner = history.players.find((player: { userId: string }) => player.userId === ana);
      assert.strictEqual(winner.winBonus, 0);
      assert.strictEqual(winner.finalBalance, 5000);
      assert.strictEqual(await testPrisma.walletEntry.count({ where: { type: "WIN_BONUS" } }), 0);
    });

    it("refuses to repeat a finish with a different decision about the bonus", async () => {
      const { playerIds: [ana], matchId } = await startMatch({ table: 2 });
      await post(`/internal/matches/${matchId}/finish`, { winnerId: ana, awardWinBonus: false });

      const same = await post(`/internal/matches/${matchId}/finish`, { winnerId: ana, awardWinBonus: false });
      const different = await post(`/internal/matches/${matchId}/finish`, { winnerId: ana, awardWinBonus: true });

      assert.deepStrictEqual([same.statusCode, different.statusCode], [200, 409]);
      assert.strictEqual(await testPrisma.walletEntry.count({ where: { type: "WIN_BONUS" } }), 0);
    });

    it("requires the decision about the bonus", async () => {
      const { playerIds: [ana], matchId } = await startMatch({ table: 2 });

      const response = await post(`/internal/matches/${matchId}/finish`, { winnerId: ana });

      assert.strictEqual(response.statusCode, 400);
    });

    it("closes a match without winner and pays no bonus", async () => {
      const { matchId } = await startMatch({ table: 2 });

      const response = await post(`/internal/matches/${matchId}/finish`, { winnerId: null, awardWinBonus: false });

      assert.strictEqual(response.statusCode, 200);
      assert.strictEqual(response.json().winnerId, null);
      assert.strictEqual(await testPrisma.walletEntry.count({ where: { type: "WIN_BONUS" } }), 0);
    });

    it("refuses a winner that is not in the match and an unknown match", async () => {
      const { matchId } = await startMatch({ table: 2 });

      const stranger = await post(`/internal/matches/${matchId}/finish`, { winnerId: randomUUID(), awardWinBonus: true });
      const unknown = await post(`/internal/matches/${randomUUID()}/finish`, { winnerId: null, awardWinBonus: false });

      assert.deepStrictEqual([stranger.statusCode, unknown.statusCode], [422, 404]);
    });
  });

  describe("eliminations", () => {
    function eliminate(matchId: string, userId: string) {
      return post(`/internal/matches/${matchId}/eliminations`, { userId });
    }

    it("records the elimination and answers the same way when it is repeated", async () => {
      const { playerIds: [, bia], matchId } = await startMatch({ table: 1, balances: [5000, 5000, 5000] });

      const first = await eliminate(matchId, bia);
      testApp.clock.now = new Date("2026-11-02T16:00:00Z");
      const again = await eliminate(matchId, bia);

      assert.strictEqual(first.statusCode, 200);
      assert.strictEqual(first.json().matchId, matchId);
      assert.strictEqual(first.json().userId, bia);
      assert.strictEqual(first.json().eliminatedAt, "2026-11-02T15:00:00.000Z");
      assert.deepStrictEqual(again.json(), first.json());
      testApp.clock.now = new Date("2026-11-02T15:00:00Z");
    });

    it("answers the same when two eliminations of the same player arrive at the same time", async () => {
      const { playerIds: [, bia], matchId } = await startMatch({ table: 1, balances: [5000, 5000, 5000] });

      const responses = await Promise.all([eliminate(matchId, bia), eliminate(matchId, bia), eliminate(matchId, bia)]);

      assert.deepStrictEqual(responses.map(({ statusCode }) => statusCode), [200, 200, 200]);
      assert.strictEqual(new Set(responses.map((response) => response.json().eliminatedAt)).size, 1);
    });

    it("frees only the eliminated account: it leaves the entry check and can join another match", async () => {
      const { playerIds: [ana, bia, caio], matchId } = await startMatch({ table: 1, balances: [5000, 5000, 5000] });
      const [biaToken, anaToken] = [await signInAs(bia), await signInAs(ana)];

      await eliminate(matchId, bia);
      const biaEntry = await post("/internal/players/entry", { accessToken: biaToken });
      const anaEntry = await post("/internal/players/entry", { accessToken: anaToken });
      const [dani, edu] = [await seedUser({ balance: 5000 }), await seedUser({ balance: 5000 })];
      const biaElsewhere = await post("/internal/matches", { table: 1, playerIds: [bia, dani, edu] });
      const anaElsewhere = await post("/internal/matches", { table: 1, playerIds: [ana, dani, edu] });

      assert.strictEqual(biaEntry.json().openMatchId, null);
      assert.strictEqual(anaEntry.json().openMatchId, matchId);
      assert.strictEqual(biaElsewhere.statusCode, 201);
      assert.strictEqual(anaElsewhere.statusCode, 409);
      assert.strictEqual(
        (await post("/internal/matches", { table: 1, playerIds: [caio, await seedUser({ balance: 5000 }), await seedUser({ balance: 5000 })] })).statusCode,
        409,
      );
    });

    it("keeps the eliminated player in the match history", async () => {
      const { playerIds: [ana, bia], matchId } = await startMatch({ table: 1, balances: [5000, 5000, 5000] });
      await eliminate(matchId, bia);

      const finished = await post(`/internal/matches/${matchId}/finish`, { winnerId: ana, awardWinBonus: true });

      assert.strictEqual(finished.statusCode, 200);
      assert.ok(finished.json().players.some((player: { userId: string }) => player.userId === bia));
    });

    it("refuses a player that is not in the match", async () => {
      const { matchId } = await startMatch({ table: 1, balances: [5000, 5000, 5000] });

      const response = await eliminate(matchId, await seedUser({ balance: 5000 }));

      assert.strictEqual(response.statusCode, 422);
      assert.strictEqual(response.json().message, errors.matches.playerNotInMatch);
    });

    it("refuses an elimination after the match was finished", async () => {
      const { playerIds: [, bia], matchId } = await startMatch({ table: 1, balances: [5000, 5000, 5000] });
      await post(`/internal/matches/${matchId}/finish`, { winnerId: null, awardWinBonus: false });

      const response = await eliminate(matchId, bia);

      assert.strictEqual(response.statusCode, 409);
      assert.strictEqual(response.json().message, errors.matches.alreadyFinished);
    });

    it("answers 404 for an unknown match and 400 for a body the API does not accept", async () => {
      const { playerIds: [, bia], matchId } = await startMatch({ table: 1, balances: [5000, 5000, 5000] });

      const unknown = await eliminate(randomUUID(), bia);
      const extra = await post(`/internal/matches/${matchId}/eliminations`, { userId: bia, reason: "left" });
      const malformed = await post(`/internal/matches/${matchId}/eliminations`, { userId: "x" });

      assert.deepStrictEqual([unknown.statusCode, extra.statusCode, malformed.statusCode], [404, 400, 400]);
    });

    it("needs the service token", async () => {
      const { playerIds: [, bia], matchId } = await startMatch({ table: 1, balances: [5000, 5000, 5000] });

      const response = await testApp.app.inject({
        method: "POST",
        url: `/internal/matches/${matchId}/eliminations`,
        payload: { userId: bia },
      });

      assert.strictEqual(response.statusCode, 401);
    });
  });
});
