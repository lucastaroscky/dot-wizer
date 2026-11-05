import type { Request, Response } from "express";
import { matchMaker, ServerError } from "colyseus";
import { CHIP_TABLES } from "@pontinho/rules";
import { JOIN_REFUSALS, ROOM_NAME, type SeatedPlayer, type TablesResponse } from "@pontinho/protocol";
import type { GameApi } from "../../gameApi/GameApi.js";
import { enter } from "./playerAuth.js";

const BEARER_PATTERN = /^Bearer (.+)$/i;

export function tableList(gameApi: GameApi) {
  return async (request: Request, response: Response) => {
    response.set({ ...matchMaker.controller.DEFAULT_CORS_HEADERS, "Access-Control-Allow-Origin": request.headers.origin ?? "*" });
    if (request.method === "OPTIONS") {
      response.sendStatus(204);
      return;
    }
    const token = request.headers.authorization?.match(BEARER_PATTERN)?.[1];
    if (!token) {
      response.status(JOIN_REFUSALS.invalidToken.code).json({ code: JOIN_REFUSALS.invalidToken.message });
      return;
    }
    try {
      await enter(gameApi, token, undefined);
    } catch (error) {
      if (!(error instanceof ServerError)) {
        throw error;
      }
      response.status(error.code).json({ code: error.message });
      return;
    }
    const rooms = await matchMaker.query({ name: ROOM_NAME, locked: false, bots: false });
    const body: TablesResponse = {
      tables: CHIP_TABLES.map(({ id }) => ({
        table: id,
        players: (rooms.find((room) => room.metadata?.table === id)?.metadata?.players as SeatedPlayer[] | undefined) ?? [],
      })),
    };
    response.json(body);
  };
}
