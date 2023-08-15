import EventEmitter from "events";
import { IncomingMessage, STATUS_CODES } from "http";
import { WebSocket } from "isomorphic-ws";
import {
  C2SRequestTypes,
  HTTPRequestPayload,
  HTTPResponsePayload,
  MAX_CHUNK_SIZE,
  ProtoBareHeaders,
  S2CRequestType,
  S2CRequestTypes,
  WSClosePayload,
  WSErrorPayload,
} from "protocol";
import { Readable, Writable } from "stream";
import { BareError, bareInitialFetch, fetchResponse, options } from "./http";

function bareErrorToResponse(e: BareError): {
  payload: HTTPResponsePayload;
  body: AsyncIterable<ArrayBuffer>;
} {
  return {
    payload: {
      status: e.status,
      statusText: STATUS_CODES[e.status] || "",
      headers: {},
    },
    // TODO: this is node specific. for web we might have to go through Blob here
    body: Readable.from(JSON.stringify(e.body)),
  };
}

export class AdriftServer {
  send: (msg: ArrayBuffer) => void;
  requestStreams: Record<number, Promise<Writable>> = {};
  sockets: Record<number, WebSocket> = {};
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

  static tryParseJSONPayload(payloadRaw: ArrayBuffer): any | undefined {
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

  async handleHTTPRequest(
    seq: number,
    payload: HTTPRequestPayload
  ): Promise<{
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
      const outgoingPromise = bareInitialFetch(
        payload,
        abort.signal,
        new URL(payload.remote),
        options
      );
      if (payload.hasBody) {
        this.requestStreams[seq] = outgoingPromise;
      }
      const outgoingStream = await outgoingPromise;
      if (!payload.hasBody) {
        outgoingStream.end();
      }
      resp = await fetchResponse(await outgoingPromise);
    } catch (e) {
      if (e instanceof BareError) {
        return bareErrorToResponse(e);
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

  _sendJSONRes(seq: number, op: S2CRequestType, payload: any) {
    const payloadBuffer = new TextEncoder().encode(JSON.stringify(payload));
    const buf = new ArrayBuffer(2 + 1 + payloadBuffer.length);
    const dataView = new DataView(buf);
    let cursor = 0;
    dataView.setUint16(cursor, seq);
    cursor += 2;
    dataView.setUint8(cursor, op);
    cursor += 1;
    new Uint8Array(buf).set(payloadBuffer, cursor);
    this.send(buf);
  }

  sendHTTPResponseStart(seq: number, payload: HTTPResponsePayload) {
    this._sendJSONRes(seq, S2CRequestTypes.HTTPResponseStart, payload);
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

  _sendSimpleRes(seq: number, op: S2CRequestType) {
    const buf = new ArrayBuffer(2 + 1);
    const dataView = new DataView(buf);
    let cursor = 0;
    dataView.setUint16(cursor, seq);
    cursor += 2;
    dataView.setUint8(cursor, op);
    this.send(buf);
  }

  sendHTTPResponseEnd(seq: number) {
    this._sendSimpleRes(seq, S2CRequestTypes.HTTPResponseEnd);
  }

  sendWSOpen(seq: number) {
    this._sendSimpleRes(seq, S2CRequestTypes.WSOpen);
  }

  sendWSClose(seq: number, payload: WSClosePayload) {
    this._sendJSONRes(seq, S2CRequestTypes.WSClose, payload);
  }

  sendWSError(seq: number, payload: WSErrorPayload) {
    this._sendJSONRes(seq, S2CRequestTypes.WSError, payload);
  }

  sendWSText(seq: number, textEncoded: ArrayBuffer) {
    const buf = new ArrayBuffer(2 + 1 + textEncoded.byteLength);
    const dataView = new DataView(buf);
    let cursor = 0;
    dataView.setUint16(cursor, seq);
    cursor += 2;
    dataView.setUint8(cursor, S2CRequestTypes.WSDataText);
    cursor += 1;
    new Uint8Array(buf).set(new Uint8Array(textEncoded), cursor);
    this.send(buf);
  }

  sendWSBinary(seq: number, msg: ArrayBuffer) {
    const buf = new ArrayBuffer(2 + 1 + msg.byteLength);
    const dataView = new DataView(buf);
    let cursor = 0;
    dataView.setUint16(cursor, seq);
    cursor += 2;
    dataView.setUint8(cursor, S2CRequestTypes.WSDataBinary);
    cursor += 1;
    new Uint8Array(buf).set(new Uint8Array(msg), cursor);
    this.send(buf);
  }

  async onMsg(msg: ArrayBuffer) {
    const init = AdriftServer.parseMsgInit(msg);
    if (!init) return;
    const { cursor, seq, op } = init;
    switch (op) {
      case C2SRequestTypes.HTTPRequestStart: {
        let resp: {
          payload: HTTPResponsePayload;
          body: AsyncIterable<ArrayBuffer>;
        };
        const reqPayload = AdriftServer.tryParseJSONPayload(msg.slice(cursor));
        if (!reqPayload) return;

        try {
          resp = await this.handleHTTPRequest(seq, reqPayload);
        } catch (e) {
          // drop the upload if we are sending an error document
          console.log("error drop");
          delete this.requestStreams[seq];
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

          resp = bareErrorToResponse(bareError);
        }

        const { payload, body: responseBody } = resp;
        this.sendHTTPResponseStart(seq, payload);

        for await (const chunk of responseBody) {
          let chunkPart = null;
          let chunkRest = chunk;
          do {
            chunkPart = chunkRest.slice(0, MAX_CHUNK_SIZE);
            chunkRest = chunkRest.slice(MAX_CHUNK_SIZE);
            this.sendHTTPResponseChunk(seq, new Uint8Array(chunkPart));
          } while (chunkRest.byteLength > 0);
        }
        this.sendHTTPResponseEnd(seq);
        // if the body upload *still* isn't done by the time the response is done
        //  downloading, kill it.
        console.log("final drop");
        delete this.requestStreams[seq];
        break;
      }

      case C2SRequestTypes.HTTPRequestChunk: {
        const stream = this.requestStreams[seq];
        if (!stream) return;
        (await stream).write(new Uint8Array(msg.slice(cursor)));
        break;
      }

      case C2SRequestTypes.HTTPRequestEnd: {
        console.log("req end");
        const stream = this.requestStreams[seq];
        if (!stream) return;
        console.log("req end drop");
        (await stream).end();
        delete this.requestStreams[seq];
        break;
      }

      case C2SRequestTypes.WSOpen: {
        const payload = AdriftServer.tryParseJSONPayload(msg.slice(cursor));
        const ws = (this.sockets[seq] = new WebSocket(payload.url));
        ws.binaryType = "arraybuffer";
        ws.onerror = (e) => {
          this.sendWSError(seq, { message: e.message });
          // onclose will be called after this with code 1006, reason "" and wasClean false
        };
        ws.onopen = () => {
          this.sendWSOpen(seq);
        };
        ws.onclose = (e) => {
          this.sendWSClose(seq, {
            code: e.code,
            reason: e.reason,
            wasClean: e.wasClean,
          });
          delete this.sockets[seq];
        };
        (ws as any).onmessage = (
          dataOrEvent: ArrayBuffer | MessageEvent<any>,
          isBinary?: boolean
        ) => {
          // we have to carefully handle two websocket libraries here
          // node ws: first arg is Buffer|ArrayBuffer|Buffer[] depending on binaryType,
          //  2nd arg is isBinary
          // web ws: first arg is an event, event.data is string if text or
          //  arraybuffer|blob depending on binaryType.
          if (dataOrEvent instanceof ArrayBuffer) {
            if (isBinary) {
              this.sendWSBinary(seq, dataOrEvent);
              return;
            }
            this.sendWSText(seq, dataOrEvent);
            return;
          }
          // unless we set binaryType incorrectly, we should be on the web here.
          if (typeof dataOrEvent.data === "string") {
            this.sendWSText(seq, new TextEncoder().encode(dataOrEvent.data));
            return;
          }
          if (dataOrEvent.data instanceof ArrayBuffer) {
            this.sendWSBinary(seq, dataOrEvent.data);
            return;
          }
          console.error({ dataOrEvent, isBinary });
          throw new Error("Unexpected message type received");
        };
        break;
      }

      case C2SRequestTypes.WSSendText: {
        const socket = this.sockets[seq];
        if (!socket) return;
        socket.send(new TextDecoder().decode(msg.slice(cursor)));
        break;
      }

      case C2SRequestTypes.WSSendBinary: {
        const socket = this.sockets[seq];
        if (!socket) return;
        socket.send(msg.slice(cursor));
        break;
      }

      case C2SRequestTypes.WSClose: {
        const socket = this.sockets[seq];
        if (!socket) return;
        const payload: WSClosePayload | undefined =
          AdriftServer.tryParseJSONPayload(msg.slice(cursor));
        if (!payload) return;
        socket.close(payload.code || 1005, payload.reason || "");
        break;
      }

      default:
        // not implemented
        break;
    }
  }

  onClose() {
    this.events.emit("close");
  }
}
