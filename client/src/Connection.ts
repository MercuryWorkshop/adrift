import {
  C2SRequestType,
  C2SRequestTypes,
  C2SWSOpenPayload,
  HTTPRequestPayload,
  HTTPResponsePayload,
  S2CRequestType,
  S2CRequestTypes,
  Transport,
} from "protocol";

export class Connection {
  requestCallbacks: Record<number, Function> = {};
  openRequestStreams: Record<number, ReadableStreamDefaultController<any>> = {};
  openingSockets: Record<number, () => void>;
  openSockets: Record<
    number,
    { onclose: () => void; onmessage: (data: any) => void }
  >;

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

    console.log(requestID, requestType);

    switch (requestType) {
      case S2CRequestTypes.HTTPResponseStart:
        const decoder = new TextDecoder();
        const payload = JSON.parse(decoder.decode(data.slice(cursor)));
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
    }
  }

  async send(
    requestID: number,
    data: ArrayBuffer | Blob,
    type: C2SRequestType
  ): Promise<void> {
    let header = new ArrayBuffer(2 + 1);
    let view = new DataView(header);

    let cursor = 0;

    view.setUint16(cursor, requestID);
    cursor += 2;
    view.setUint8(cursor, type);
    cursor += 1;

    let buf = await new Blob([header, data]).arrayBuffer();

    this.transport.send(buf);
    console.log(buf);
  }

  httprequest(
    data: HTTPRequestPayload
  ): Promise<{ payload: HTTPResponsePayload; body: ArrayBuffer }> {
    let json = JSON.stringify(data);

    return new Promise(async (resolve) => {
      let seq = this.nextSeq();
      this.requestCallbacks[seq] = resolve;
      await this.send(seq, new Blob([json]), C2SRequestTypes.HTTPRequest);
    });
  }

  wsconnect(
    url: URL,
    onopen: () => void,
    onclose: () => void,
    onmessage: (data: any) => void
  ): {
    send: (data: any) => void;
    close: (code?: number, reason?: string) => void;
  } {
    const payload: C2SWSOpenPayload = { url: url.toString() };
    const payloadJSON = JSON.stringify(payload);
    let seq = this.nextSeq();
    this.send(
      seq,
      new TextEncoder().encode(payloadJSON),
      C2SRequestTypes.WSOpen
    ).catch((e) => {
      console.error(e);
      onclose();
    });

    // this can't be async, just call onopen when opened
    this.openingSockets[seq] = onopen;

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
            new TextEncoder().encode(data),
            C2SRequestTypes.WSSendText
          ).catch(cleanup);
          return;
        }
        if (data instanceof ArrayBuffer) {
          this.send(seq, data, C2SRequestTypes.WSSendBinary).catch(cleanup);
          return;
        }
        if (ArrayBuffer.isView(data)) {
          this.send(
            seq,
            data.buffer.slice(
              data.byteOffset,
              data.byteOffset + data.byteLength
            ),
            C2SRequestTypes.WSSendBinary
          ).catch(cleanup);
          return;
        }
        console.error({ data });
        throw new Error("Unexpected type passed to send");
      },
      close: (code?: number, reason?: string) => {
        const payload = JSON.stringify({ code, reason });
        this.send(
          seq,
          new TextEncoder().encode(payload),
          C2SRequestTypes.WSClose
        ).catch((e) => {
          // At this point there is nothing left to clean up
          console.error(e);
        });
        delete this.openSockets[seq];
      },
    };
  }
}
