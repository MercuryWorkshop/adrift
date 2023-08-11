
import Connection from "./Connection";
import { BareClient as BareClientCustom, registerRemoteListener, setBareClientImplementation, Client, GetRequestHeadersCallback, MetaCallback, ReadyStateCallback, WebSocketImpl, BareHeaders, BareResponse } from "bare-client-custom";


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
  async request(method: string, requestHeaders: BareHeaders, body: BodyInit | null, remote: URL, cache: string | undefined, duplex: string | undefined, signal: AbortSignal | undefined): Promise<BareResponse> {
    let rawResponse = await this.connection.httprequest({ a: "test data" });

    return new Response(JSON.stringify(rawResponse)) as BareResponse;
  }
  async connect(remote: URL, protocols: string[], getRequestHeaders: GetRequestHeadersCallback, onMeta: MetaCallback, onReadyState: ReadyStateCallback, webSocketImpl: WebSocketImpl): WebSocket {

  }
}
