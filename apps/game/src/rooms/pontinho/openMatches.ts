import { matchMaker } from "colyseus";

export type OpenSeat = { matchId: string; reconnectionToken: string };

function matchKey(matchId: string) {
  return `pontinho:match:${matchId}`;
}

function seatKey(userId: string) {
  return `pontinho:seat:${userId}`;
}

function startingKey(userId: string) {
  return `pontinho:starting:${userId}`;
}

async function remember(description: string, write: () => unknown) {
  try {
    await write();
  } catch (error) {
    console.error(`Falha ao ${description} na presence:`, error);
  }
}

export const openMatches = {
  registerMatch(matchId: string, roomId: string) {
    return remember("registrar a partida aberta", () => matchMaker.presence.set(matchKey(matchId), roomId));
  },

  forgetMatch(matchId: string) {
    return remember("esquecer a partida aberta", () => matchMaker.presence.del(matchKey(matchId)));
  },

  markStarting(userIds: string[], roomId: string) {
    return remember("marcar a partida em abertura", () => Promise.all(userIds.map((userId) => matchMaker.presence.set(startingKey(userId), roomId))));
  },

  clearStarting(userIds: string[]) {
    return remember("limpar a partida em abertura", () => Promise.all(userIds.map((userId) => matchMaker.presence.del(startingKey(userId)))));
  },

  keepSeat(userId: string, seat: OpenSeat) {
    return remember("guardar o assento reservado", () => matchMaker.presence.set(seatKey(userId), JSON.stringify(seat)));
  },

  forgetSeat(userId: string) {
    return remember("esquecer o assento reservado", () => matchMaker.presence.del(seatKey(userId)));
  },

  async roomOf(matchId: string): Promise<string | undefined> {
    return (await matchMaker.presence.get(matchKey(matchId))) ?? undefined;
  },

  async startingRoomOf(userId: string): Promise<string | undefined> {
    return (await matchMaker.presence.get(startingKey(userId))) ?? undefined;
  },

  async seatOf(userId: string): Promise<OpenSeat | undefined> {
    const stored = await matchMaker.presence.get(seatKey(userId));
    if (!stored) {
      return undefined;
    }
    return JSON.parse(stored) as OpenSeat;
  },
};
