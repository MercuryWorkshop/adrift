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
    throw new Error("unimplemented");
  }
}
