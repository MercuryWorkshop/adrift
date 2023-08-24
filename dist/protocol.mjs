// protocol/src/Transport.ts
var Transport = class {
  constructor(onopen, onclose) {
    this.onopen = onopen;
    this.onclose = onclose;
  }
  ondata = () => {
  };
};

// protocol/src/index.ts
var C2SRequestTypes = {
  HTTPRequestStart: 0,
  HTTPRequestChunk: 1,
  HTTPRequestEnd: 2,
  WSOpen: 3,
  WSClose: 4,
  WSSendText: 5,
  WSSendBinary: 6
};
var S2CRequestTypes = {
  HTTPResponseStart: 0,
  HTTPResponseChunk: 1,
  HTTPResponseEnd: 2,
  WSOpen: 3,
  WSClose: 4,
  WSTextStart: 5,
  WSBinaryStart: 6,
  WSDataChunk: 7,
  WSDataEnd: 8,
  WSError: 9
};
var MAX_CHUNK_SIZE = 12 * 1024;
var S2C_HELLO_OK = ":3";
var C2S_HELLO = "haiii ";
var S2C_HELLO_ERR = ":< ";
var PROTOCOL_VERSION = "3.0";
export {
  C2SRequestTypes,
  C2S_HELLO,
  MAX_CHUNK_SIZE,
  PROTOCOL_VERSION,
  S2CRequestTypes,
  S2C_HELLO_ERR,
  S2C_HELLO_OK,
  Transport
};
