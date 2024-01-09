var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// client/src/AdriftClient.ts
import {
  Client
} from "@mercuryworkshop/bare-client-custom";
import { MAX_CHUNK_SIZE } from "protocol";
var NULL_BODY_STATUSES = [101, 103, 204, 205, 304];
function createBodyStream(body, arrayBufferImpl) {
  if (body === null || typeof body === "undefined")
    return null;
  if (typeof body === "string") {
    body = new TextEncoder().encode(body);
  }
  if (window.ArrayBuffer.isView(body)) {
    body = body.buffer.slice(
      body.byteOffset,
      body.byteOffset + body.byteLength
    );
  }
  if (body instanceof window.ArrayBuffer) {
    if (body.byteLength == 0) {
      return null;
    }
    let remaining = body;
    return new ReadableStream({
      type: "bytes",
      pull: (controller) => {
        if (remaining.byteLength <= 0) {
          return controller.close();
        }
        const current = remaining.slice(0, MAX_CHUNK_SIZE);
        remaining = remaining.slice(MAX_CHUNK_SIZE);
        controller.enqueue(new Uint8Array(current));
      }
    });
  }
  if (body instanceof FormData) {
    throw new Error("formdata todo");
  }
  const transformer = () => new TransformStream({
    transform: async (chunk, controller) => {
      if (typeof chunk === "string") {
        chunk = new TextEncoder().encode(chunk);
      }
      if (chunk instanceof Blob) {
        chunk = await chunk.arrayBuffer();
      }
      if (window.ArrayBuffer.isView(chunk)) {
        chunk = chunk.buffer.slice(
          chunk.byteOffset,
          chunk.byteOffset + chunk.byteLength
        );
      }
      if (!(chunk instanceof window.ArrayBuffer)) {
        console.error({ chunk });
        throw new Error("Invalid type read from body stream: " + chunk);
      }
      let current = null;
      let remaining = chunk;
      do {
        current = remaining.slice(0, MAX_CHUNK_SIZE);
        remaining = remaining.slice(MAX_CHUNK_SIZE);
        controller.enqueue(new Uint8Array(current));
      } while (remaining.byteLength > 0);
    }
  });
  if (body instanceof ReadableStream) {
    return body.pipeThrough(transformer());
  }
  if (body instanceof Blob) {
    return body.stream().pipeThrough(transformer());
  }
  throw new Error("Unexpected body type: " + body);
}
var AdriftBareClient = class extends Client {
  constructor(connection) {
    super();
    this.connection = connection;
  }
  async request(method, requestHeaders, body, remote, cache, duplex, signal, arrayBufferImpl) {
    const bodyStream = createBodyStream(body, arrayBufferImpl);
    let { payload, body: respRawBody } = await this.connection.httprequest(
      {
        method,
        requestHeaders,
        remote
      },
      bodyStream
    );
    const headers = new Headers();
    for (const [header, values] of Object.entries(payload.headers)) {
      for (const value of values) {
        headers.append(header, value);
      }
    }
    let respBody = respRawBody;
    if (respBody.byteLength == 0 || NULL_BODY_STATUSES.includes(payload.status)) {
      respBody = null;
    }
    return new Response(respBody, {
      status: payload.status,
      statusText: payload.statusText,
      headers
    });
  }
  connect(remote, protocols, getRequestHeaders, onMeta, onReadyState, webSocketImpl, arrayBufferImpl) {
    console.log(arguments);
    const ws = new webSocketImpl("wss:null", protocols);
    let initalCloseHappened = false;
    ws.addEventListener("close", (e) => {
      if (!initalCloseHappened) {
        onReadyState(WebSocket.CONNECTING);
        e.stopImmediatePropagation();
        initalCloseHappened = true;
      }
    });
    let initialErrorHappened = false;
    ws.addEventListener("error", (e) => {
      if (!initialErrorHappened) {
        onReadyState(WebSocket.CONNECTING);
        e.stopImmediatePropagation();
        initialErrorHappened = true;
      }
    });
    protocols = Array.from(protocols);
    let { send, close } = this.connection.wsconnect(
      remote,
      protocols,
      (protocol) => {
        onReadyState(WebSocket.OPEN);
        ws.__defineGetter__("protocol", () => {
          return protocol;
        });
        ws.dispatchEvent(new Event("open"));
      },
      (code, reason, wasClean) => {
        onReadyState(WebSocket.CLOSED);
        ws.dispatchEvent(new CloseEvent("close", { code, reason, wasClean }));
      },
      async (stream, isBinary) => {
        let data = await new Response(
          stream
        ).arrayBuffer();
        data.__proto__ = arrayBufferImpl.prototype;
        if (!isBinary) {
          try {
            data = new TextDecoder().decode(data);
          } catch (e) {
            console.error(e);
            return;
          }
        }
        ws.dispatchEvent(new MessageEvent("message", { data }));
      },
      (message) => {
        console.log({ message });
        ws.dispatchEvent(new ErrorEvent("error", { message }));
      },
      arrayBufferImpl,
      arrayBufferImpl.prototype.constructor.constructor("return __uv$location")().origin
    );
    ws.send = (data) => {
      send(data);
    };
    ws.close = (code, reason) => {
      close(code, reason);
      onReadyState(WebSocket.CLOSING);
    };
    return ws;
  }
};

// client/src/Connection.ts
import {
  C2SRequestTypes,
  C2S_HELLO,
  PROTOCOL_VERSION,
  S2CRequestTypes,
  S2C_HELLO_ERR,
  S2C_HELLO_OK
} from "protocol";
ReadableStream.prototype[Symbol.asyncIterator] = async function* () {
  const reader = this.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done)
        return;
      yield value;
    }
  } finally {
    reader.releaseLock();
  }
};
var Connection = class _Connection {
  constructor(transport) {
    this.transport = transport;
    this.initialized = false;
    this.requestCallbacks = {};
    this.openRequestStreams = {};
    this.openingSockets = {};
    this.openSockets = {};
    this.wsMsgStreams = {};
    this.counter = 0;
    transport.ondata = _Connection.uninitializedError;
  }
  static uninitializedError() {
    throw new Error("Connection not initialized");
  }
  async initialize() {
    const onDataPromise = () => {
      return new Promise((res) => {
        this.transport.ondata = res;
      });
    };
    this.transport.send(new TextEncoder().encode(C2S_HELLO + PROTOCOL_VERSION));
    const msg = await onDataPromise();
    const msgText = new TextDecoder().decode(msg);
    if (msgText === S2C_HELLO_OK) {
      this.transport.ondata = this.ondata.bind(this);
      this.initialized = true;
    } else if (msgText.startsWith(S2C_HELLO_ERR)) {
      const expectedVersion = msgText.slice(S2C_HELLO_ERR.length);
      throw new Error(
        `We are running protocol version ${PROTOCOL_VERSION}, but server expected ${expectedVersion}`
      );
    } else {
      throw new Error("Unexpected server hello response");
    }
  }
  nextSeq() {
    return ++this.counter;
  }
  ondata(data) {
    if (!this.initialized)
      return;
    let cursor = 0;
    const view = new DataView(data);
    let requestID = view.getUint16(cursor);
    cursor += 2;
    let requestType = view.getUint8(cursor);
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
          },
          cancel: () => {
          }
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
        if (!socketMeta)
          return;
        const payload2 = msgJSON();
        delete this.openingSockets[requestID];
        this.openSockets[requestID] = socketMeta;
        setTimeout(() => socketMeta.onopen(payload2.protocol));
        break;
      }
      case S2CRequestTypes.WSBinaryStart:
      case S2CRequestTypes.WSTextStart: {
        const socketMeta = this.openSockets[requestID];
        if (!socketMeta)
          return;
        const stream2 = new ReadableStream({
          start: (controller) => {
            this.wsMsgStreams[requestID] = controller;
          },
          pull: (constroller) => {
          },
          cancel: () => {
          }
        });
        setTimeout(
          () => socketMeta.onmessage(
            stream2,
            requestType === S2CRequestTypes.WSBinaryStart ? true : requestType === S2CRequestTypes.WSTextStart ? false : (() => {
              throw new Error("unreachable");
            })()
          )
        );
        break;
      }
      case S2CRequestTypes.WSDataChunk: {
        const stream2 = this.wsMsgStreams[requestID];
        stream2?.enqueue(new Uint8Array(data.slice(cursor)));
        break;
      }
      case S2CRequestTypes.WSDataEnd: {
        const stream2 = this.wsMsgStreams[requestID];
        stream2?.close();
        break;
      }
      case S2CRequestTypes.WSClose: {
        const socketMeta = this.openingSockets[requestID] || this.openSockets[requestID];
        if (!socketMeta)
          return;
        const payload2 = msgJSON();
        setTimeout(
          () => socketMeta.onclose(
            payload2.code || 1005,
            payload2.reason || "",
            "wasClean" in payload2 ? Boolean(payload2.wasClean) : false
          )
        );
        delete this.openingSockets[requestID];
        delete this.openSockets[requestID];
        break;
      }
      case S2CRequestTypes.WSError: {
        const socketMeta = this.openingSockets[requestID] || this.openSockets[requestID];
        if (!socketMeta)
          return;
        const payload2 = msgJSON();
        setTimeout(() => socketMeta.onerror(payload2.message));
        break;
      }
      default:
        break;
    }
  }
  async send(requestID, type, data) {
    if (!this.initialized) {
      _Connection.uninitializedError();
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
  httprequest(data, body) {
    if (!this.initialized) {
      _Connection.uninitializedError();
    }
    const payload = { ...data, hasBody: Boolean(body) };
    let json = JSON.stringify(payload);
    return new Promise(async (resolve) => {
      let seq = this.nextSeq();
      this.requestCallbacks[seq] = resolve;
      await this.send(seq, C2SRequestTypes.HTTPRequestStart, new Blob([json]));
      if (payload.hasBody) {
        for await (const chunk of body) {
          await this.send(
            seq,
            C2SRequestTypes.HTTPRequestChunk,
            new Uint8Array(chunk)
          );
        }
        await this.send(seq, C2SRequestTypes.HTTPRequestEnd);
      }
    });
  }
  wsconnect(url, protocols, onopen, onclose, onmessage, onerror, arrayBufferImpl, host) {
    if (!this.initialized) {
      _Connection.uninitializedError();
    }
    const payload = { url: url.toString(), protocols, host };
    const payloadJSON = JSON.stringify(payload);
    let seq = this.nextSeq();
    const closeWithError = () => onclose(1006, "", false);
    this.send(
      seq,
      C2SRequestTypes.WSOpen,
      new TextEncoder().encode(payloadJSON)
    ).catch((e) => {
      console.error(e);
      closeWithError();
    });
    this.openingSockets[seq] = {
      onopen,
      onmessage,
      onclose,
      onerror
    };
    return {
      send: (data) => {
        if (!this.openSockets[seq]) {
          throw new Error("send on closed socket");
        }
        const cleanup = (e) => {
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
      close: (code, reason) => {
        const payload2 = { code, reason };
        const payloadJSON2 = JSON.stringify(payload2);
        this.send(
          seq,
          C2SRequestTypes.WSClose,
          new TextEncoder().encode(payloadJSON2)
        ).catch((e) => {
          console.error(e);
        });
        delete this.openSockets[seq];
      }
    };
  }
};

// client/src/DevWsTransport.ts
import { Transport as Transport2 } from "protocol";
var DevWsTransport = class extends Transport2 {
  constructor(onopen, onclose) {
    super(onopen, onclose);
    this.ws = new WebSocket("ws://localhost:3000/dev-ws");
    this.ws.binaryType = "arraybuffer";
    this.ws.onopen = onopen;
    this.ws.onclose = onclose;
    this.ws.onmessage = this.onmessage.bind(this);
  }
  onmessage(msg) {
    if (msg.data instanceof window.ArrayBuffer) {
      this.ondata(msg.data);
      return;
    }
  }
  send(data) {
    this.ws.send(data);
  }
  close() {
    this.ws.close();
  }
};

// client/src/RTCTransport.ts
import { Transport as Transport3 } from "protocol";
var rtcConf = {
  iceServers: [
    {
      urls: "stun:stun.l.google.com:19302"
    }
  ]
};
var RTCTransport = class extends Transport3 {
  constructor(onopen, onclose, onconnectionstatechange, onsignalingstatechange, onicegatheringstatechange) {
    super(onopen, onclose);
    this.onopen = onopen;
    this.onclose = onclose;
    this.onconnectionstatechange = onconnectionstatechange;
    this.onsignalingstatechange = onsignalingstatechange;
    this.onicegatheringstatechange = onicegatheringstatechange;
    this.peer = new RTCPeerConnection(rtcConf);
    this.peer.onconnectionstatechange = onconnectionstatechange;
    this.peer.onsignalingstatechange = onsignalingstatechange;
    this.peer.oniceconnectionstatechange = (event) => {
      console.log("ICE connection state:", this.peer.iceConnectionState);
      if (this.peer.iceConnectionState == "disconnected" || this.peer.iceConnectionState == "failed") {
        console.log("disconnected");
        onclose();
      }
    };
    this.peer.onicegatheringstatechange = onicegatheringstatechange;
    this.dataChannel = this.peer.createDataChannel("host-server");
    this.dataChannel.onopen = onopen;
    this.dataChannel.binaryType = "arraybuffer";
    this.dataChannel.onclose = onclose;
    this.dataChannel.onmessage = async (event) => {
      let buf = event.data;
      this.ondata(buf);
    };
  }
  send(data) {
    this.dataChannel.send(data);
  }
  close() {
    this.dataChannel.close();
  }
  async createOffer() {
    const localCandidates = [];
    let readyPromise = new Promise((resolve, reject) => {
      this.peer.onicecandidate = async (event) => {
        if (event.candidate) {
          localCandidates.push(event.candidate);
          return;
        }
        resolve({ offer, localCandidates });
      };
    });
    const offer = await this.peer.createOffer();
    await this.peer.setLocalDescription(offer);
    return readyPromise;
  }
  async answer(answer, candidates) {
    await this.peer.setRemoteDescription(answer);
    for (let candidate of candidates) {
      await this.peer.addIceCandidate(candidate);
    }
  }
};

// client/src/SignalFirebase.ts
var SignalFirebase_exports = {};
__export(SignalFirebase_exports, {
  signalAccount: () => signalAccount,
  signalSwarm: () => signalSwarm
});
import {
  getDatabase,
  onValue,
  ref,
  set,
  remove,
  goOffline
} from "firebase/database";
import { v4 as uuid } from "uuid";
import { getAuth } from "firebase/auth";
async function signalSwarm(offer) {
  let id = uuid();
  const db = getDatabase();
  let reff = ref(db, `/swarm/${id}`);
  set(reff, offer);
  return new Promise((resolve, reject) => {
    onValue(reff, (snapshot) => {
      const text = snapshot.val();
      if (!text)
        return;
      let data = JSON.parse(text);
      console.log("<", data);
      if (data.error) {
        reject(new Error(data.error));
        return;
      }
      if (!(data && data.answer && data.candidates))
        return;
      remove(reff);
      resolve(data);
    });
  });
}
async function signalAccount(offer) {
  let auth = getAuth();
  if (!auth.currentUser)
    throw new Error("not signed in");
  const db = getDatabase();
  let peer = ref(db, `/peers/${auth.currentUser.uid}`);
  set(peer, offer);
  return new Promise((resolve, reject) => {
    onValue(peer, async (snapshot) => {
      const str = snapshot.val();
      if (str) {
        let data = JSON.parse(str);
        if (data && data.answer && data.candidates) {
          remove(peer);
          resolve(data);
          goOffline(db);
        }
      }
    });
  });
}

// client/src/index.ts
function downloadShortcut(name, title) {
  let a = document.createElement("a");
  a.href = "data:text/plain;base64," + btoa(`
    <!DOCTYPE html>
    <html lang="en">
    
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${title}</title>
        <style>
            body,
            html {
                padding: 0;
                margin: 0;
                width: 100vw;
                height: 100vh;
                overflow: hidden;
            }
    
            iframe {
                width: 100%;
                height: 100%;
                border: none;
                outline: none;
    
            }
        </style>
    
    </head>
    
    <body>
        <iframe src="${location.href}" />
    </body>
    
    </html>
`);
  console.log(a.href);
  a.download = name;
  a.click();
}
export {
  AdriftBareClient,
  Connection,
  DevWsTransport,
  RTCTransport,
  SignalFirebase_exports as SignalFirebase,
  downloadShortcut
};
