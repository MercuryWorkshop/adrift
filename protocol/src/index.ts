export type ObjectValues<T> = T[keyof T];
export const C2SRequestTypes = {
  HTTPRequestStart: 0,
  HTTPRequestChunk: 1,
  HTTPRequestEnd: 2,
  WSOpen: 3,
  WSClose: 4,
  WSSendText: 5,
  WSSendBinary: 6,
} as const;
export type C2SRequestType = ObjectValues<typeof C2SRequestTypes>;

export const S2CRequestTypes = {
  HTTPResponseStart: 0,
  HTTPResponseChunk: 1,
  HTTPResponseEnd: 2,
  WSOpen: 3,
  WSClose: 4,
  WSTextStart: 5,
  WSBinaryStart: 6,
  WSDataChunk: 7,
  WSDataEnd: 8,
  WSError: 9,
} as const;
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

// WebRTC max is 16K, let's say 12K to be safe
export const MAX_CHUNK_SIZE = 12 * 1024;

export const S2C_HELLO_OK = ":3";
// these two end with a version string
export const C2S_HELLO = "haiii ";
export const S2C_HELLO_ERR = ":< ";

export const PROTOCOL_VERSION = "3.0";

export { Transport } from "./Transport";
