import { IncomingMessage, STATUS_CODES } from "http";

import EventEmitter from "events";

import {
  C2SRequestTypes,
  HTTPRequestPayload,
  HTTPResponsePayload,
  ProtoBareHeaders,
  S2CRequestTypes,
} from "protocol";
import { Readable } from "stream";
import { BareError, bareFetch, options } from "./http";

export class Client {
  send: (msg: ArrayBuffer) => void;
  events: EventEmitter;

  constructor(send: (msg: ArrayBuffer) => void) {
    this.send = send;
    this.events = new EventEmitter();
  }

  static parseMsgInit(
    msg: ArrayBuffer
  ): { cursor: number; seq: number; op: number } | undefined {
    try {
      console.log(msg);
      const dataView = new DataView(msg);
      let cursor = 0;
      const seq = dataView.getUint16(cursor);
      cursor += 2;
      const op = dataView.getUint8(cursor);
      cursor += 1;
      return { cursor, seq, op };
    } catch (e) {
      if (e instanceof RangeError) {
        // malformed message
        return;
      }
      throw e;
    }
  }

  static parseHttpReqPayload(
    payloadRaw: ArrayBuffer
  ): HTTPRequestPayload | undefined {
    let payload;
    try {
      payload = JSON.parse(new TextDecoder().decode(payloadRaw));
    } catch (e) {
      if (e instanceof SyntaxError) {
        return;
      }
      throw e;
    }
    console.log({ payload });
    return payload;
  }

  static bareErrorToResponse(e: BareError): {
    payload: HTTPResponsePayload;
    body: AsyncIterable<ArrayBuffer>;
  } {
    return {
      payload: {
        status: e.status,
        statusText: STATUS_CODES[e.status] || "",
        headers: {},
      },
      body: Readable.from(JSON.stringify(e.body)),
    };
  }

  async handleHTTPRequest(payload: HTTPRequestPayload): Promise<{
    payload: HTTPResponsePayload;
    body: AsyncIterable<ArrayBuffer>;
  }> {
    const abort = new AbortController();
    const onClose = () => {
      abort.abort();
      this.events.off("close", onClose);
    };
    this.events.on("close", onClose);

    let resp: IncomingMessage;
    try {
      resp = await bareFetch(
        payload,
        abort.signal,
        new URL(payload.remote),
        options
      );
    } catch (e) {
      if (e instanceof BareError) {
        return Client.bareErrorToResponse(e);
      }
      this.events.off("close", onClose);
      throw e;
    }

    this.events.off("close", onClose);

    return {
      payload: {
        status: resp.statusCode || 500,
        statusText: resp.statusMessage || "",
        headers: Object.fromEntries(
          Object.entries(resp.headersDistinct).filter(([_k, v]) => Boolean(v))
        ) as ProtoBareHeaders,
      },
      body: resp,
    };
  }

  sendHTTPResponseStart(seq: number, payload: HTTPResponsePayload) {
    const payloadBuffer = new TextEncoder().encode(JSON.stringify(payload));
    const buf = new ArrayBuffer(2 + 1 + payloadBuffer.length);
    const dataView = new DataView(buf);
    let cursor = 0;
    dataView.setUint16(cursor, seq);
    cursor += 2;
    dataView.setUint8(cursor, S2CRequestTypes.HTTPResponseStart);
    cursor += 1;
    new Uint8Array(buf).set(payloadBuffer, cursor);
    this.send(buf);
  }

  sendHTTPResponseChunk(seq: number, chunk: Uint8Array) {
    const buf = new ArrayBuffer(2 + 1 + chunk.byteLength);
    const dataView = new DataView(buf);
    let cursor = 0;
    dataView.setUint16(cursor, seq);
    cursor += 2;
    dataView.setUint8(cursor, S2CRequestTypes.HTTPResponseChunk);
    cursor += 1;
    new Uint8Array(buf).set(chunk, cursor);
    this.send(buf);
  }

  sendHTTPResponseEnd(seq: number) {
    const buf = new ArrayBuffer(2 + 1);
    const dataView = new DataView(buf);
    let cursor = 0;
    dataView.setUint16(cursor, seq);
    cursor += 2;
    dataView.setUint8(cursor, S2CRequestTypes.HTTPResponseEnd);
    this.send(buf);
  }

  async onMsg(msg: ArrayBuffer) {
    const init = Client.parseMsgInit(msg);
    if (!init) return;
    const { cursor, seq, op } = init;
    switch (op) {
      case C2SRequestTypes.HTTPRequest:
        let resp: {
          payload: HTTPResponsePayload;
          body: AsyncIterable<ArrayBuffer>;
        };
        const reqPayload = Client.parseHttpReqPayload(msg.slice(cursor));
        if (!reqPayload) return;
        try {
          resp = await this.handleHTTPRequest(reqPayload);
        } catch (e) {
          if (options.logErrors) console.error(e);

          let bareError;
          if (e instanceof BareError) {
            bareError = e;
          } else if (e instanceof Error) {
            bareError = new BareError(500, {
              code: "UNKNOWN",
              id: `error.${e.name}`,
              message: e.message,
              stack: e.stack,
            });
          } else {
            bareError = new BareError(500, {
              code: "UNKNOWN",
              id: "error.Exception",
              message: "Error: " + e,
              stack: new Error(<string | undefined>e).stack,
            });
          }

          resp = Client.bareErrorToResponse(bareError);
        }

        const { payload, body } = resp;
        this.sendHTTPResponseStart(seq, payload);
        for await (const chunk of body) {
          this.sendHTTPResponseChunk(seq, new Uint8Array(chunk));
        }
        this.sendHTTPResponseEnd(seq);
        break;
      default:
        // not implemented
        break;
    }
  }

  onClose() {
    this.events.emit("close");
  }
}
