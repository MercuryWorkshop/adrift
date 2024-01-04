import {
  C2SRequestType,
  C2SRequestTypes,
  C2SWSOpenPayload,
  C2S_HELLO,
  HTTPRequestPayload,
  HTTPResponsePayload,
  PROTOCOL_VERSION,
  ProtoBareHeaders,
  S2CRequestType,
  S2CRequestTypes,
  S2CWSOpenPayload,
  S2C_HELLO_ERR,
  S2C_HELLO_OK,
  Transport,
  WSClosePayload,
  WSErrorPayload,
} from "protocol";

type OpenWSMeta = {
  onopen: (protocol: string) => void;
  onclose: (code: number, reason: string, wasClean: boolean) => void;
  onmessage: (data: ReadableStream, isBinary: boolean) => void;
  onerror: (message: string) => void;
};

(ReadableStream as any).prototype[Symbol.asyncIterator] = async function*() {
  const reader = this.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) return;
      yield value;
    }
  } finally {
    reader.releaseLock();
  }
};

export class Connection {
  initialized = false;
  requestCallbacks: Record<number, Function> = {};
  openRequestStreams: Record<number, ReadableStreamDefaultController<any>> = {};
  openingSockets: Record<number, OpenWSMeta> = {};
  openSockets: Record<number, OpenWSMeta> = {};
  wsMsgStreams: Record<number, ReadableStreamDefaultController<any>> = {};

  counter: number = 0;

  static uninitializedError() {
    throw new Error("Connection not initialized");
  }

  constructor(public transport: Transport) {
    transport.ondata = Connection.uninitializedError;
  }

  async initialize(): Promise<void> {
    const onDataPromise = (): Promise<ArrayBuffer> => {
      return new Promise((res) => {
        this.transport.ondata = res;
      });
    };
    // maybe some sort of timeout here?
    // this code is not the best tbh
    this.transport.send(new TextEncoder().encode(C2S_HELLO + PROTOCOL_VERSION));
    const msg = await onDataPromise();
    const msgText = new TextDecoder().decode(msg);
    if (msgText === S2C_HELLO_OK) {
      this.transport.ondata = this.ondata.bind(this);
      this.initialized = true;
    } else if (msgText.startsWith(S2C_HELLO_ERR)) {
      const expectedVersion = msgText.slice(S2C_HELLO_ERR.length);
      throw new Error(
        `We are running protocol version ${PROTOCOL_VERSION}, ` +
        `but server expected ${expectedVersion}`
      );
    } else {
      throw new Error("Unexpected server hello response");
    }
  }

  nextSeq() {
    return ++this.counter;
  }

  ondata(data: ArrayBuffer) {
    if (!this.initialized) return;

    let cursor = 0;
    const view = new DataView(data);

    let requestID = view.getUint16(cursor);
    cursor += 2;
    let requestType = view.getUint8(cursor) as S2CRequestType;
    cursor += 1;

    const msgText = () => new TextDecoder().decode(data.slice(cursor));
    const msgJSON = () => JSON.parse(msgText());

    switch (requestType) {
      case S2CRequestTypes.HTTPResponseStart:
        const payload = msgJSON();
        const stream = new ReadableStream({
          start: (controller) => {
            this.openRequestStreams[requestID] = controller;
          },
          pull: (controller) => {
            // not needed
          },
          cancel: () => {
            // TODO
          },
        });
        this.requestCallbacks[requestID]({ payload, body: stream });
        delete this.requestCallbacks[requestID];
        break;

      case S2CRequestTypes.HTTPResponseChunk:
        this.openRequestStreams[requestID]?.enqueue(
          new Uint8Array(data.slice(cursor))
        );
        break;

      case S2CRequestTypes.HTTPResponseEnd:
        this.openRequestStreams[requestID]?.close();
        delete this.openRequestStreams[requestID];
        break;

      case S2CRequestTypes.WSOpen: {
        const socketMeta = this.openingSockets[requestID];
        if (!socketMeta) return;
        const payload: S2CWSOpenPayload = msgJSON();
        delete this.openingSockets[requestID];
        this.openSockets[requestID] = socketMeta;
        setTimeout(() => socketMeta.onopen(payload.protocol));
        break;
      }

      case S2CRequestTypes.WSBinaryStart:
      case S2CRequestTypes.WSTextStart: {
        const socketMeta = this.openSockets[requestID];
        if (!socketMeta) return;
        const stream = new ReadableStream({
          start: (controller) => {
            this.wsMsgStreams[requestID] = controller;
          },
          pull: (constroller) => {
            // not needed
          },
          cancel: () => {
            // TODO
          },
        });
        setTimeout(() =>
          socketMeta.onmessage(
            stream,
            requestType === S2CRequestTypes.WSBinaryStart
              ? true
              : requestType === S2CRequestTypes.WSTextStart
                ? false
                : (() => {
                  throw new Error("unreachable");
                })()
          )
        );
        break;
      }

      case S2CRequestTypes.WSDataChunk: {
        const stream = this.wsMsgStreams[requestID];
        stream?.enqueue(new Uint8Array(data.slice(cursor)));
        break;
      }

      case S2CRequestTypes.WSDataEnd: {
        const stream = this.wsMsgStreams[requestID];
        stream?.close();
        break;
      }

      case S2CRequestTypes.WSClose: {
        const socketMeta =
          this.openingSockets[requestID] || this.openSockets[requestID];
        if (!socketMeta) return;
        const payload: WSClosePayload = msgJSON();
        setTimeout(() =>
          socketMeta.onclose(
            payload.code || 1005,
            payload.reason || "",
            "wasClean" in payload ? Boolean(payload.wasClean) : false
          )
        );
        delete this.openingSockets[requestID];
        delete this.openSockets[requestID];
        break;
      }

      case S2CRequestTypes.WSError: {
        const socketMeta =
          this.openingSockets[requestID] || this.openSockets[requestID];
        if (!socketMeta) return;
        const payload: WSErrorPayload = msgJSON();
        setTimeout(() => socketMeta.onerror(payload.message));
        // don't delete socket entries because server will send close after this
        break;
      }

      default:
        break;
    }
  }

  async send(
    requestID: number,
    type: C2SRequestType,
    data?: ArrayBuffer | Blob
  ): Promise<void> {
    if (!this.initialized) {
      Connection.uninitializedError();
    }

    let header = new window.ArrayBuffer(2 + 1);
    let view = new DataView(header);

    let cursor = 0;

    view.setUint16(cursor, requestID);
    cursor += 2;
    view.setUint8(cursor, type);
    cursor += 1;

    let buf = header;
    if (data) {
      buf = await new Blob([header, data]).arrayBuffer();
    }

    this.transport.send(buf);
  }

  httprequest(
    data: {
      method: string;
      requestHeaders: ProtoBareHeaders;
      remote: URL;
    },
    body: ReadableStream<ArrayBuffer | Uint8Array> | null
  ): Promise<{ payload: HTTPResponsePayload; body: ArrayBuffer }> {
    if (!this.initialized) {
      Connection.uninitializedError();
    }

    const payload: HTTPRequestPayload = { ...data, hasBody: Boolean(body) };
    let json = JSON.stringify(payload);

    return new Promise(async (resolve) => {
      let seq = this.nextSeq();
      this.requestCallbacks[seq] = resolve;
      await this.send(seq, C2SRequestTypes.HTTPRequestStart, new Blob([json]));

      if (payload.hasBody) {
        for await (const chunk of body as unknown as NodeJS.ReadableStream) {
          await this.send(
            seq,
            C2SRequestTypes.HTTPRequestChunk,
            new Uint8Array(chunk as Uint8Array | ArrayBuffer)
          );
        }
        await this.send(seq, C2SRequestTypes.HTTPRequestEnd);
      }
    });
  }

  wsconnect(
    url: URL,
    protocols: string | string[],
    onopen: (protocol: string) => void,
    onclose: (code: number, reason: string, wasClean: boolean) => void,
    onmessage: (data: ReadableStream, isBinary: boolean) => void,
    onerror: (message: string) => void,
    arrayBufferImpl: ArrayBufferConstructor,
    host: string
  ): {
    send: (data: any) => void;
    close: (code?: number, reason?: string) => void;
  } {
    if (!this.initialized) {
      Connection.uninitializedError();
    }

    const payload: C2SWSOpenPayload = { url: url.toString(), protocols, host };
    const payloadJSON = JSON.stringify(payload);
    let seq = this.nextSeq();
    // todo: onerror
    const closeWithError = () => onclose(1006, "", false);

    this.send(
      seq,
      C2SRequestTypes.WSOpen,
      new TextEncoder().encode(payloadJSON)
    ).catch((e) => {
      console.error(e);
      closeWithError();
    });

    // this can't be async, just call onopen when opened
    this.openingSockets[seq] = {
      onopen,
      onmessage,
      onclose,
      onerror,
    };

    return {
      send: (data) => {
        if (!this.openSockets[seq]) {
          throw new Error("send on closed socket");
        }
        const cleanup = (e: any) => {
          console.error(e);
          delete this.openSockets[seq];
        };
        if (typeof data === "string") {
          this.send(
            seq,
            C2SRequestTypes.WSSendText,
            new TextEncoder().encode(data)
          ).catch(cleanup);
          return;
        }
        if (data instanceof arrayBufferImpl) {
          this.send(seq, C2SRequestTypes.WSSendBinary, data).catch(cleanup);
          return;
        }
        if (arrayBufferImpl.isView(data)) {
          this.send(
            seq,
            C2SRequestTypes.WSSendBinary,
            data.buffer.slice(
              data.byteOffset,
              data.byteOffset + data.byteLength
            )
          ).catch(cleanup);
          return;
        }
        console.error({ data });
        throw new Error("Unexpected type passed to send");
      },
      close: (code?: number, reason?: string) => {
        const payload = { code, reason };
        const payloadJSON = JSON.stringify(payload);
        this.send(
          seq,
          C2SRequestTypes.WSClose,
          new TextEncoder().encode(payloadJSON)
        ).catch((e) => {
          // At this point there is nothing left to clean up
          console.error(e);
        });
        delete this.openSockets[seq];
      },
    };
  }
}
