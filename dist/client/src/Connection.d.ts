import { C2SRequestType, HTTPResponsePayload, ProtoBareHeaders, Transport } from "protocol";
type OpenWSMeta = {
    onopen: (protocol: string) => void;
    onclose: (code: number, reason: string, wasClean: boolean) => void;
    onmessage: (data: ReadableStream, isBinary: boolean) => void;
    onerror: (message: string) => void;
};
export declare class Connection {
    transport: Transport;
    initialized: boolean;
    requestCallbacks: Record<number, Function>;
    openRequestStreams: Record<number, ReadableStreamDefaultController<any>>;
    openingSockets: Record<number, OpenWSMeta>;
    openSockets: Record<number, OpenWSMeta>;
    wsMsgStreams: Record<number, ReadableStreamDefaultController<any>>;
    counter: number;
    static uninitializedError(): void;
    constructor(transport: Transport);
    initialize(): Promise<void>;
    nextSeq(): number;
    ondata(data: ArrayBuffer): void;
    send(requestID: number, type: C2SRequestType, data?: ArrayBuffer | Blob): Promise<void>;
    httprequest(data: {
        method: string;
        requestHeaders: ProtoBareHeaders;
        remote: URL;
    }, body: ReadableStream<ArrayBuffer | Uint8Array> | null): Promise<{
        payload: HTTPResponsePayload;
        body: ArrayBuffer;
    }>;
    wsconnect(url: URL, protocols: string | string[], onopen: (protocol: string) => void, onclose: (code: number, reason: string, wasClean: boolean) => void, onmessage: (data: ReadableStream, isBinary: boolean) => void, onerror: (message: string) => void, arrayBufferImpl: ArrayBufferConstructor, host: string): {
        send: (data: any) => void;
        close: (code?: number, reason?: string) => void;
    };
}
export {};
