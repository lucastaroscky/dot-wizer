import { defineServer, defineRoom, monitor, playground } from "colyseus";
import { ROOM_NAME, TABLES_PATH } from "@pontinho/protocol";
import type { GameApi } from "./gameApi/GameApi.js";
import { createPontinhoRoom } from "./rooms/pontinho/PontinhoRoom.js";
import { tableList } from "./rooms/pontinho/tableList.js";

type ServerOptions = { beforeListen?: () => Promise<void> };

export function createServer(gameApi: GameApi, { beforeListen }: ServerOptions = {}) {
  return defineServer({
    beforeListen,
    rooms: {
      [ROOM_NAME]: defineRoom(createPontinhoRoom(gameApi)).filterBy(["table", "seats", "bots"]),
    },
    express: (app) => {
      app.options(TABLES_PATH, tableList(gameApi));
      app.get(TABLES_PATH, tableList(gameApi));
      if (process.env.ENABLE_DEV_TOOLS !== "true") {
        return;
      }
      app.use("/monitor", monitor());
      app.use("/", playground());
    },
  });
}
