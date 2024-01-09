import { BareHeaders, BareResponse, Client, GetRequestHeadersCallback, MetaCallback, ReadyStateCallback, WebSocketImpl } from "@mercuryworkshop/bare-client-custom";
import { Connection } from "./Connection";
export declare class AdriftBareClient extends Client {
    private connection;
    constructor(connection: Connection);
    request(method: string, requestHeaders: BareHeaders, body: BodyInit | null, remote: URL, cache: string | undefined, duplex: string | undefined, signal: AbortSignal | undefined, arrayBufferImpl: ArrayBufferConstructor): Promise<BareResponse>;
    connect(remote: URL, protocols: string | string[], getRequestHeaders: GetRequestHeadersCallback, onMeta: MetaCallback, onReadyState: ReadyStateCallback, webSocketImpl: WebSocketImpl, arrayBufferImpl: ArrayBufferConstructor): WebSocket;
}
