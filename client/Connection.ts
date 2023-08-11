import Transport from "./Transport";


type ObjectValues<T> = T[keyof T];
const C2SRequestTypes = {
  HTTPRequest: 0,
  WSOpen: 1,
  WSClose: 2,
  WSSendText: 3,
  WSSendBinary: 4,
} as const;
type C2SRequestType = ObjectValues<typeof C2SRequestTypes>

const S2CRequestTypes = {
  HTTPResponse: 0,
  WSOpen: 1,
  WSDataText: 2,
  WSDataBinary: 3,
} as const;
type S2CRequestType = ObjectValues<typeof S2CRequestTypes>




export default class Connection {


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
        let decoder = new TextDecoder();
        let text = decoder.decode(data.slice(cursor));
        console.log(text);
        let json = JSON.parse(text);

        console.log(requestID);

        this.callbacks[requestID](json);
        break;
      }
    }
  }

  async send(data: ArrayBuffer | Blob, type: C2SRequestType): Promise<number> {

    let requestID = this.counter++;

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

    return requestID;

  }

  httprequest(data: object): Promise<object> {
    let json = JSON.stringify(data);

    return new Promise(async (resolve) => {

      let id = this.counter;
      this.callbacks[id] = resolve;
      await this.send(new Blob([json]), C2SRequestTypes.HTTPRequest);
    });
  }
}
