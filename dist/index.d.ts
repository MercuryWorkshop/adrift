export type ObjectValues<T> = T[keyof T];
export declare const C2SRequestTypes: {
    readonly HTTPRequestStart: 0;
    readonly HTTPRequestChunk: 1;
    readonly HTTPRequestEnd: 2;
    readonly WSOpen: 3;
    readonly WSClose: 4;
    readonly WSSendText: 5;
    readonly WSSendBinary: 6;
};
export type C2SRequestType = ObjectValues<typeof C2SRequestTypes>;
export declare const S2CRequestTypes: {
    readonly HTTPResponseStart: 0;
    readonly HTTPResponseChunk: 1;
    readonly HTTPResponseEnd: 2;
    readonly WSOpen: 3;
    readonly WSClose: 4;
    readonly WSTextStart: 5;
    readonly WSBinaryStart: 6;
    readonly WSDataChunk: 7;
    readonly WSDataEnd: 8;
    readonly WSError: 9;
};
export type S2CRequestType = ObjectValues<typeof S2CRequestTypes>;
export type ProtoBareHeaders = Record<string, string | string[]>;
export type HTTPRequestPayload = {
    method: string;
    requestHeaders: ProtoBareHeaders;
    remote: URL;
    hasBody: boolean;
};
export type HTTPResponsePayload = {
    status: number;
    statusText: string;
    headers: ProtoBareHeaders;
};
export type C2SWSOpenPayload = {
    url: string;
    protocols: string | string[];
    host: string;
};
export type S2CWSOpenPayload = {
    protocol: string;
};
export type WSClosePayload = {
    code: number;
    reason: string;
    wasClean: boolean;
};
export type WSErrorPayload = {
    message: string;
};
export declare const MAX_CHUNK_SIZE: number;
export declare const S2C_HELLO_OK = ":3";
export declare const C2S_HELLO = "haiii ";
export declare const S2C_HELLO_ERR = ":< ";
export declare const PROTOCOL_VERSION = "3.0";
export { Transport } from "./Transport";
