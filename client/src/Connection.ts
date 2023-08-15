import { ReadableStream } from "node:stream/web";
import {
  C2SRequestType,
  C2SRequestTypes,
  C2SWSOpenPayload,
  HTTPRequestPayload,
  HTTPResponsePayload,
  S2CRequestType,
  S2CRequestTypes,
  Transport,
  WSClosePayload,
  WSErrorPayload,
} from "protocol";

type OpenWSMeta = {
  onopen: () => void;
  onclose: (code: number, reason: string, wasClean: boolean) => void;
  onmessage: (data: any) => void;
  onerror: (message: string) => void;
};

export class Connection {
  requestCallbacks: Record<number, Function> = {};
  openRequestStreams: Record<number, ReadableStreamDefaultController<any>> = {};
  openingSockets: Record<number, OpenWSMeta> = {};
  openSockets: Record<number, OpenWSMeta> = {};

  counter: number = 0;

  constructor(public transport: Transport) {
    transport.ondata = this.ondata.bind(this);
  }

  nextSeq() {
    return ++this.counter;
  }

  ondata(data: ArrayBuffer) {
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

      case S2CRequestTypes.WSOpen:
        const socketMeta = this.openingSockets[requestID];
        delete this.openingSockets[requestID];
        this.openSockets[requestID] = socketMeta;
        setTimeout(() => socketMeta.onopen());
        break;

      case S2CRequestTypes.WSDataText: {
        const socketMeta = this.openSockets[requestID];
        if (!socketMeta) return;
        setTimeout(() => socketMeta.onmessage(msgText()));
        break;
      }

      case S2CRequestTypes.WSDataBinary: {
        const socketMeta = this.openSockets[requestID];
        if (!socketMeta) return;
        setTimeout(() => socketMeta.onmessage(data.slice(cursor)));
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
    let header = new ArrayBuffer(2 + 1);
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
    data: HTTPRequestPayload,
    body: ReadableStream<ArrayBuffer | Uint8Array> | null
  ): Promise<{ payload: HTTPResponsePayload; body: ArrayBuffer }> {
    let json = JSON.stringify(data);

    return new Promise(async (resolve) => {
      let seq = this.nextSeq();
      this.requestCallbacks[seq] = resolve;
      await this.send(seq, C2SRequestTypes.HTTPRequestStart, new Blob([json]));

      if (body) {
        for await (const chunk of body) {
          await this.send(
            seq,
            C2SRequestTypes.HTTPRequestChunk,
            new Uint8Array(chunk)
          );
        }
      }
      await this.send(seq, C2SRequestTypes.HTTPRequestEnd);
    });
  }

  wsconnect(
    url: URL,
    onopen: () => void,
    onclose: (code: number, reason: string, wasClean: boolean) => void,
    onmessage: (data: any) => void,
    onerror: (message: string) => void
  ): {
    send: (data: any) => void;
    close: (code?: number, reason?: string) => void;
  } {
    const payload: C2SWSOpenPayload = { url: url.toString() };
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
        if (data instanceof ArrayBuffer) {
          this.send(seq, C2SRequestTypes.WSSendBinary, data).catch(cleanup);
          return;
        }
        if (ArrayBuffer.isView(data)) {
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
