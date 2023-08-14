import {
  BareHeaders,
  BareResponse,
  Client,
  GetRequestHeadersCallback,
  MetaCallback,
  ReadyStateCallback,
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
    // IP of TEST-NET-1 (https://superuser.com/a/698392/917616)
    const ws = new webSocketImpl("ws:192.0.2.0", protocols);
    // this will error. that's okay
    let initalCloseHappened = false;
    ws.addEventListener("close", (e) => {
      if (!initalCloseHappened) {
        // we can freely mess with the fake readyState here because there is no
        //  readyStateChange listener for WebSockets
        onReadyState(WebSocket.CONNECTING);
        e.stopImmediatePropagation();
        initalCloseHappened = true;
      }
    });
    let initialErrorHappened = false;
    ws.addEventListener("error", (e) => {
      if (!initialErrorHappened) {
        onReadyState(WebSocket.CONNECTING);
        e.stopImmediatePropagation();
        initialErrorHappened = true;
      }
    });

    let { send, close } = this.connection.wsconnect(
      remote,
      () => {
        onReadyState(WebSocket.OPEN);
        ws.dispatchEvent(new Event("open"));
      },
      (code: number, reason: string, wasClean: boolean) => {
        onReadyState(WebSocket.CLOSED);
        ws.dispatchEvent(new CloseEvent("close", { code, reason, wasClean }));
      },
      (data) => {
        ws.dispatchEvent(
          new MessageEvent("message", {
            data,
          })
        );
      },
      (message: string) => {
        console.log({ message });
        ws.dispatchEvent(new ErrorEvent("error", { message }));
      }
    );

    ws.send = (data: any) => {
      send(data);
    };

    ws.close = (code?: number, reason?: string) => {
      close(code, reason);
      onReadyState(WebSocket.CLOSING);
    };

    return ws;
  }
}
