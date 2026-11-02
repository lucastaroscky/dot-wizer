import { defineServer, defineRoom, monitor, playground } from "colyseus";
import { ROOM_NAME } from "@pontinho/protocol";
import type { GameApi } from "./gameApi/GameApi.js";
import { createPontinhoRoom } from "./rooms/pontinho/PontinhoRoom.js";

type ServerOptions = { beforeListen?: () => Promise<void> };

export function createServer(gameApi: GameApi, { beforeListen }: ServerOptions = {}) {
  return defineServer({
    beforeListen,
    rooms: {
      [ROOM_NAME]: defineRoom(createPontinhoRoom(gameApi)).filterBy(["table", "seats", "bots"]),
    },
    express: (app) => {
      if (process.env.ENABLE_DEV_TOOLS !== "true") {
        return;
      }
      app.use("/monitor", monitor());
      app.use("/", playground());
    },
  });
}
