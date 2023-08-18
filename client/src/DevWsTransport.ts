import { Transport } from "protocol";

export class DevWsTransport extends Transport {
  ws: WebSocket;

  constructor(onopen: () => void, onclose: () => void) {
    super(onopen, onclose);

    this.ws = new WebSocket("ws://localhost:3000/dev-ws");
    this.ws.binaryType = "arraybuffer";
    this.ws.onopen = onopen;
    this.ws.onclose = onclose;
    this.ws.onmessage = this.onmessage.bind(this);
  }

  onmessage(msg: MessageEvent<any>) {
    if (msg.data instanceof window.ArrayBuffer) {
      this.ondata(msg.data);
      return;
    }
    // ignore text messages
  }

  send(data: ArrayBuffer) {
    this.ws.send(data);
  }

  close() {
    this.ws.close();
  }
}
