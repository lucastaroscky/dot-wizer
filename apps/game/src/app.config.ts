import { defineServer, defineRoom, monitor, playground } from "colyseus";
import { ROOM_NAME } from "@pontinho/protocol";
import { PontinhoRoom } from "./rooms/PontinhoRoom.js";

const server = defineServer({
  rooms: {
    [ROOM_NAME]: defineRoom(PontinhoRoom).filterBy(["seats", "bots"]),
  },
  express: (app) => {
    if (process.env.ENABLE_DEV_TOOLS !== "true") {
      return;
    }
    app.use("/monitor", monitor());
    app.use("/", playground());
  },
});

export default server;
