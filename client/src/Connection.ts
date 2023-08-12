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
      case S2CRequestTypes.HTTPResponse: {
        const payloadLen = view.getUint32(cursor);
        cursor += 4;
        const decoder = new TextDecoder();
        const payloadRaw = decoder.decode(
          data.slice(cursor, cursor + payloadLen)
        );
        console.log({ payloadLen, payloadRaw });
        const payload = JSON.parse(payloadRaw);
        cursor += payloadLen;

        this.callbacks[requestID]({ payload, body: data.slice(cursor) });
        break;
      }
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
}
