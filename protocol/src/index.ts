export type ObjectValues<T> = T[keyof T];
export const C2SRequestTypes = {
  HTTPRequest: 0,
  WSOpen: 1,
  WSClose: 2,
  WSSendText: 3,
  WSSendBinary: 4,
} as const;
export type C2SRequestType = ObjectValues<typeof C2SRequestTypes>;

export const S2CRequestTypes = {
  HTTPResponseStart: 0,
  HTTPResponseChunk: 1,
  HTTPResponseEnd: 2,
  WSOpen: 3,
  WSDataText: 4,
  WSDataBinary: 5,
  WSClose: 6,
} as const;
export type S2CRequestType = ObjectValues<typeof S2CRequestTypes>;

export type ProtoBareHeaders = Record<string, string | string[]>;

export type HTTPRequestPayload = {
  method: string;
  requestHeaders: ProtoBareHeaders;
  body: string | null;
  remote: URL;
};

export type HTTPResponsePayload = {
  status: number;
  statusText: string;
  headers: ProtoBareHeaders;
};

export { Transport } from "./Transport";
