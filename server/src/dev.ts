import dotenv from "dotenv";
import express from "express";
import expressWs from "express-ws";

import { AdriftServer, connectTracker } from "./server";

import WebSocket from "isomorphic-ws";
import { answerRtc, bufferToArrayBuffer } from "./rtc";
import { PROTOCOL_VERSION } from "protocol";

dotenv.config();

const app = express() as unknown as expressWs.Application;
expressWs(app);

app.use(express.json());
app.use((_req, res, next) => {
  res.header("x-robots-tag", "noindex");
  res.header("access-control-allow-headers", "*");
  res.header("access-control-allow-origin", "*");
  res.header("access-control-allow-methods", "*");
  res.header("access-control-expose-headers", "*");
  next();
});

app.post("/connect", (req, res) => {
  const data = req.body;
  answerRtc(data, (d) => {
    res.json(d);
  });
});

app.ws("/dev-ws", (ws, _req) => {
  console.log("ws connect");
  const client = new AdriftServer(
    (msg) => ws.send(msg),
    () => ws.close()
  );

  ws.on("message", (msg) => {
    if (typeof msg === "string") {
      msg = Buffer.from(msg);
    }

    if (msg instanceof Buffer) {
      client.onMsg(bufferToArrayBuffer(msg));
      return;
    }
    throw new Error("Unexpected message type");
  });
});

try {
  let tracker = new WebSocket(`ws://localhost:17776/join?protocol=${PROTOCOL_VERSION}`);
  tracker.onerror = console.error;
  connectTracker(tracker);
} catch (_) { }

app.listen(3000, () => console.log("listening"));
