import {
  C2SRequestType,
  C2SRequestTypes,
  HTTPRequestPayload,
  HTTPResponsePayload,
  S2CRequestType,
  S2CRequestTypes,
  Transport,
} from "protocol";

export class Connection {
  callbacks: Record<number, Function> = {};
  openStreams: Record<number, ReadableStreamDefaultController<any>> = {};

  counter: number = 0;

  constructor(public transport: Transport) {
    transport.ondata = this.ondata.bind(this);
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
            this.openStreams[requestID] = controller;
          },
          pull: (controller) => {
            // not needed
          },
          cancel: () => {
            // TODO
          },
        });
        this.callbacks[requestID]({ payload, body: stream });
        break;

      case S2CRequestTypes.HTTPResponseChunk:
        this.openStreams[requestID]?.enqueue(
          new Uint8Array(data.slice(cursor))
        );
        break;

      case S2CRequestTypes.HTTPResponseEnd:
        this.openStreams[requestID]?.close();
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
      let id = ++this.counter;
      this.callbacks[id] = resolve;
      await this.send(id, new Blob([json]), C2SRequestTypes.HTTPRequest);
    });
  }
  // idk the type of data, figure it out ig
  wsconnect(url: URL, onopen: () => void, onclose: () => void, onmessage: (data: any) => void): (data: any) => void {

    // do the connection shit here

    onopen();
    // this can't be async, just call onopen when opened

    return (data) => {

      // send "data" to the server
    };

  }
}
