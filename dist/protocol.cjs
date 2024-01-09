var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// protocol/src/index.ts
var src_exports = {};
__export(src_exports, {
  C2SRequestTypes: () => C2SRequestTypes,
  C2S_HELLO: () => C2S_HELLO,
  MAX_CHUNK_SIZE: () => MAX_CHUNK_SIZE,
  PROTOCOL_VERSION: () => PROTOCOL_VERSION,
  S2CRequestTypes: () => S2CRequestTypes,
  S2C_HELLO_ERR: () => S2C_HELLO_ERR,
  S2C_HELLO_OK: () => S2C_HELLO_OK,
  Transport: () => Transport
});
module.exports = __toCommonJS(src_exports);

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
