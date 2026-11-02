import { defineServer, defineRoom, monitor, playground } from "colyseus";
import { ROOM_NAME } from "@pontinho/protocol";
import type { GameApi } from "./gameApi/GameApi.js";
import { createPontinhoRoom } from "./rooms/pontinho/PontinhoRoom.js";

export function createServer(gameApi: GameApi) {
  return defineServer({
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
