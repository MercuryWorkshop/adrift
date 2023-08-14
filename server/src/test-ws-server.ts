import { WebSocketServer } from "ws";

const wss = new WebSocketServer({ host: "127.0.0.1", port: 3002 });

wss.on("connection", (ws) => {
  console.log("new connection");
  ws.binaryType = "nodebuffer";

  ws.on("message", (data: Buffer, isBinary: boolean) => {
    if (isBinary) {
      console.log("received a binary message of length " + data.length);
      ws.send(data);
      return;
    }
    const text = data.toString();
    console.log("received a text message of length " + text.length);
    if (text == "bye") {
      console.log("closing");
      ws.close(1009, "your mom");
      return;
    }
    ws.send(text);
  });

  ws.on("close", (code, reason) => {
    console.log("closed", { code, reason: reason.toString() });
  });
});
