import {
  BareHeaders,
  BareResponse,
  Client,
  GetRequestHeadersCallback,
  MetaCallback,
  ReadyStateCallback,
  WebSocketFields,
  WebSocketImpl,
} from "bare-client-custom";
import { Connection } from "./Connection";

// export class Adrift {
//   bareclient:AdriftBareClient,
//   constructor(connection:Connection){
//
//   }
// }
//
const WebSocketFields = {
  prototype: {
    send: WebSocket.prototype.send,
  },
  CLOSED: WebSocket.CLOSED,
  CLOSING: WebSocket.CLOSING,
  CONNECTING: WebSocket.CONNECTING,
  OPEN: WebSocket.OPEN,
};

export class AdriftBareClient extends Client {
  constructor(private connection: Connection) {
    super();
  }
  async request(
    method: string,
    requestHeaders: BareHeaders,
    body: BodyInit | null,
    remote: URL,
    cache: string | undefined,
    duplex: string | undefined,
    signal: AbortSignal | undefined
  ): Promise<BareResponse> {
    if (
      body !== null &&
      typeof body !== "undefined" &&
      typeof body !== "string"
    ) {
      console.log({ body });
      throw new Error("bare-client-custom passed an unexpected body type");
    }
    let { payload, body: respBody } = await this.connection.httprequest({
      method,
      requestHeaders,
      body,
      remote,
    });
    const headers = new Headers();
    for (const [header, values] of Object.entries(payload.headers)) {
      for (const value of <string[]>values) {
        headers.append(header, value);
      }
    }

    return new Response(respBody, {
      status: payload.status,
      statusText: payload.statusText,
      headers,
    }) as BareResponse;
  }

  connect(
    remote: URL,
    protocols: string[],
    getRequestHeaders: GetRequestHeadersCallback,
    onMeta: MetaCallback,
    onReadyState: ReadyStateCallback,
    webSocketImpl: WebSocketImpl
  ): WebSocket {
    const ws = new webSocketImpl("ws:null");
    // this will error. that's okay

    let send = this.connection.wsconnect(
      remote,
      () => {
        onReadyState(WebSocketFields.OPEN);
        ws.dispatchEvent(new Event("open"));
      },
      () => {
        onReadyState(WebSocketFields.CLOSED);
        ws.dispatchEvent(new Event("close"));

        // what do i do for WebSocketFields.closing?
      },
      (data) => {
        ws.dispatchEvent(
          new MessageEvent("message", {
            data,
          })
        );
      }
    );

    // const cleanup = () => {
    //   ws.removeEventListener('close', closeListener);
    //   ws.removeEventListener('message', messageListener);
    // };

    // const closeListener = () => {
    //   cleanup();
    // };

    (ws as any).__defineGetter__("send", () => (data: any) => {
      send(data);
    });
    (ws as any).__defineSetter__("send", () => {});
    // ws.send = (data) => {
    //   console.log("sending data to server:" + data);
    // };
    // console.log(ws.send);

    const messageListener = (event: MessageEvent) => {
      // cleanup();

      // // ws.binaryType is irrelevant when sending text
      // if (typeof event.data !== 'string')
      //   throw new TypeError('the first websocket message was not a text frame');

      // const message = JSON.parse(event.data) as SocketServerToClient;

      // // finally
      // if (message.type !== 'open')
      //   throw new TypeError('message was not of open type');

      // event.stopImmediatePropagation();

      // onMeta({
      //   protocol: message.protocol,
      //   setCookies: message.setCookies,
      // });

      // // now we want the client to see the websocket is open and ready to communicate with the remote
      // onReadyState(WebSocketFields.OPEN);

      ws.dispatchEvent(new Event("open"));
    };

    // ws.addEventListener('close', closeListener);
    ws.addEventListener("message", messageListener);

    // // CONNECTED TO THE BARE SERVER, NOT THE REMOTE
    // ws.addEventListener(
    //   'open',
    //   (event) => {
    //     // we have to cancel this event because it doesn't reflect the connection to the remote
    //     // once we are actually connected to the remote, we can dispatch a fake open event.
    //     event.stopImmediatePropagation();

    //     // we need to fake the readyState value again so it remains CONNECTING
    //     // right now, it's open because we just connected to the remote
    //     // but we need to fake this from the client so it thinks it's still connecting
    //     onReadyState(WebSocketFields.CONNECTING);

    //     getRequestHeaders().then((headers) =>
    //       WebSocketFields.prototype.send.call(
    //         ws,
    //         JSON.stringify({
    //           type: 'connect',
    //           remote: remote.toString(),
    //           protocols,
    //           headers,
    //           forwardHeaders: [],
    //         } as SocketClientToServer)
    //       )
    //     );
    //   },
    //   // only block the open event once
    //   { once: true }
    // );

    return ws;
  }
}
