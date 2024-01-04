import EventEmitter from "events";
import { IncomingMessage, STATUS_CODES } from "http";
import { WebSocket } from "isomorphic-ws";
import { WebSocket as nodews } from "ws";
import {
  C2SRequestTypes,
  C2S_HELLO,
  HTTPRequestPayload,
  HTTPResponsePayload,
  MAX_CHUNK_SIZE,
  PROTOCOL_VERSION,
  ProtoBareHeaders,
  S2CRequestType,
  S2CRequestTypes,
  S2CWSOpenPayload,
  S2C_HELLO_ERR,
  S2C_HELLO_OK,
  WSClosePayload,
  WSErrorPayload,
} from "protocol";
import { Readable, Writable } from "stream";
import { BareError, bareInitialFetch, fetchResponse, options } from "./http";
import { answerRtc } from "./rtc";

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
  initialized: boolean = false;
  send: (msg: ArrayBuffer) => void;
  close: () => void;
  requestStreams: Record<number, Promise<Writable>> = {};
  sockets: Record<number, WebSocket> = {};
  events: EventEmitter;

  constructor(send: (msg: ArrayBuffer) => void, close: () => void) {
    this.send = send;
    this.close = close;
    this.events = new EventEmitter();
  }

  handleHello(msg: ArrayBuffer) {
    try {
      const text = new TextDecoder().decode(msg);
      if (!text.startsWith(C2S_HELLO)) {
        this.close();
        return;
      }
      // later if we want we can supported multiple versions and run different behavior based
      //  on which we are talking to, might be too much effort idk
      const version = text.slice(C2S_HELLO.length);
      if (version === PROTOCOL_VERSION) {
        this.send(new TextEncoder().encode(S2C_HELLO_OK));
        this.initialized = true;
      } else {
        this.send(new TextEncoder().encode(S2C_HELLO_ERR + PROTOCOL_VERSION));
        this.close();
      }
    } catch (_) {
      this.close();
    }
  }

  static parseMsgInit(
    msg: ArrayBuffer
  ): { cursor: number; seq: number; op: number } | undefined {
    try {
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

  _sendSimpleRes(seq: number, op: S2CRequestType) {
    const buf = new ArrayBuffer(2 + 1);
    const dataView = new DataView(buf);
    let cursor = 0;
    dataView.setUint16(cursor, seq);
    cursor += 2;
    dataView.setUint8(cursor, op);
    this.send(buf);
  }

  _sendBufRes(seq: number, op: S2CRequestType, payload: Uint8Array) {
    const payloadArr = new Uint8Array(payload);
    const buf = new ArrayBuffer(2 + 1 + payloadArr.length);
    const dataView = new DataView(buf);
    let cursor = 0;
    dataView.setUint16(cursor, seq);
    cursor += 2;
    dataView.setUint8(cursor, op);
    cursor += 1;
    new Uint8Array(buf).set(payloadArr, cursor);
    this.send(buf);
  }

  _sendJSONRes(seq: number, op: S2CRequestType, payload: any) {
    this._sendBufRes(
      seq,
      op,
      new TextEncoder().encode(JSON.stringify(payload))
    );
  }

  sendHTTPResponseStart(seq: number, payload: HTTPResponsePayload) {
    this._sendJSONRes(seq, S2CRequestTypes.HTTPResponseStart, payload);
  }

  sendHTTPResponseChunk(seq: number, chunk: Uint8Array) {
    this._sendBufRes(seq, S2CRequestTypes.HTTPResponseChunk, chunk);
  }

  sendHTTPResponseEnd(seq: number) {
    this._sendSimpleRes(seq, S2CRequestTypes.HTTPResponseEnd);
  }

  sendWSOpen(seq: number, payload: S2CWSOpenPayload) {
    this._sendJSONRes(seq, S2CRequestTypes.WSOpen, payload);
  }

  sendWSClose(seq: number, payload: WSClosePayload) {
    this._sendJSONRes(seq, S2CRequestTypes.WSClose, payload);
  }

  sendWSError(seq: number, payload: WSErrorPayload) {
    this._sendJSONRes(seq, S2CRequestTypes.WSError, payload);
  }

  streamWSData(seq: number, isBinary: boolean, textEncoded: ArrayBuffer) {
    this._sendSimpleRes(
      seq,
      isBinary ? S2CRequestTypes.WSBinaryStart : S2CRequestTypes.WSTextStart
    );
    let remaining = textEncoded;
    do {
      const chunk = remaining.slice(0, MAX_CHUNK_SIZE);
      remaining = remaining.slice(MAX_CHUNK_SIZE);
      this._sendBufRes(seq, S2CRequestTypes.WSDataChunk, new Uint8Array(chunk));
    } while (remaining.byteLength > 0);
    this._sendSimpleRes(seq, S2CRequestTypes.WSDataEnd);
  }

  async onMsg(msg: ArrayBuffer) {
    if (!this.initialized) {
      this.handleHello(msg);
      return;
    }

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
        const stream = this.requestStreams[seq];
        if (!stream) return;
        (await stream).end();
        delete this.requestStreams[seq];
        break;
      }

      case C2SRequestTypes.WSOpen: {
        const payload = AdriftServer.tryParseJSONPayload(msg.slice(cursor));
        console.log(payload.host);
        const ws = (this.sockets[seq] = new WebSocket(
          payload.url,
          payload.protocols,
          {
            headers: {
              "Origin": payload.host,
            }
          }
        ));
        ws.binaryType = "arraybuffer";
        ws.onerror = (e) => {
          this.sendWSError(seq, { message: e.message });
          // onclose will be called after this with code 1006, reason "" and wasClean false
        };
        ws.onopen = () => {
          this.sendWSOpen(seq, { protocol: ws.protocol });
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
            this.streamWSData(seq, Boolean(isBinary), dataOrEvent);
            return;
          }
          // unless we set binaryType incorrectly, we should be on the web here.
          if (typeof dataOrEvent.data === "string") {
            this.streamWSData(
              seq,
              false,
              new TextEncoder().encode(dataOrEvent.data)
            );
            return;
          }
          if (dataOrEvent.data instanceof ArrayBuffer) {
            this.streamWSData(seq, true, dataOrEvent.data);
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

export function connectTracker(tracker: WebSocket) {
  tracker.on("message", (str: string) => {
    if (!str) return;
    let data = JSON.parse(str);
    if (!(data && data.offer && data.localCandidates)) return;
    console.log("got offer");

    answerRtc(data, (answer) => {
      console.log("have an answer");
      tracker.send(JSON.stringify(answer));
    });
  });
}
