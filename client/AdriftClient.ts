import {
  BareHeaders,
  BareResponse,
  Client,
  GetRequestHeadersCallback,
  MetaCallback,
  ReadyStateCallback,
  WebSocketImpl,
} from "bare-client-custom";
import Connection from "./Connection";

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
    let rawResponse = await this.connection.httprequest({ a: "test data" });

    return new Response(JSON.stringify(rawResponse)) as BareResponse;
  }
  async connect(
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
