import { matchMaker } from "colyseus";

export type OpenSeat = { matchId: string; reconnectionToken: string };

function matchKey(matchId: string) {
  return `pontinho:match:${matchId}`;
}

function seatKey(userId: string) {
  return `pontinho:seat:${userId}`;
}

export const openMatches = {
  async registerMatch(matchId: string, roomId: string) {
    await matchMaker.presence.set(matchKey(matchId), roomId);
  },

  async forgetMatch(matchId: string) {
    await matchMaker.presence.del(matchKey(matchId));
  },

  async roomOf(matchId: string): Promise<string | undefined> {
    return (await matchMaker.presence.get(matchKey(matchId))) ?? undefined;
  },

  async keepSeat(userId: string, seat: OpenSeat) {
    await matchMaker.presence.set(seatKey(userId), JSON.stringify(seat));
  },

  async forgetSeat(userId: string) {
    await matchMaker.presence.del(seatKey(userId));
  },

  async seatOf(userId: string): Promise<OpenSeat | undefined> {
    const stored = await matchMaker.presence.get(seatKey(userId));
    if (!stored) {
      return undefined;
    }
    return JSON.parse(stored) as OpenSeat;
  },
};
