import Transport from "../protocol/Transport";

export class DevWsTransport extends Transport {
  ws: WebSocket;

  constructor(onopen, onclose) {
    super(onopen, onclose);

    this.ws = new WebSocket("ws://localhost:3000/dev-ws");
    this.ws.binaryType = "arraybuffer";
    this.ws.onopen = onopen;
    this.ws.onclose = onclose;
    this.ws.onmessage = this.onmessage.bind(this);
  }

  onmessage(msg: MessageEvent<any>) {
    if (msg.data instanceof ArrayBuffer) {
      this.ondata(msg.data);
      return;
    }
    // ignore text messages
  }

  send(data: ArrayBuffer) {
    this.ws.send(data);
  }
}
