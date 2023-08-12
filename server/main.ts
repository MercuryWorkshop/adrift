import { LookupAddress, LookupAllOptions, lookup } from "dns";
import dotenv from "dotenv";
import EventEmitter from "events";
import express from "express";
import expressWs from "express-ws";
import {
  ClientRequest,
  Agent as HTTPAgent,
  IncomingMessage,
  RequestOptions,
  STATUS_CODES,
  request as httpRequest,
} from "http";
import { Agent as HTTPSAgent, request as httpsRequest } from "https";
import { isValid, parse } from "ipaddr.js";
import { Readable } from "stream";
import * as wrtc from "wrtc";
import {
  C2SRequestTypes,
  HTTPRequestPayload,
  HTTPResponsePayload,
  ProtoBareHeaders,
  S2CRequestTypes,
} from "../protocol";

const configuration = {
  iceServers: [
    {
      urls: "stun:stun.l.google.com:19302",
    },
  ],
};
dotenv.config();

async function connect(
  offer,
  candidates,
  onAnswer: (answer: Record<string, any>) => void
) {
  const localCandidates: any[] = [];
  let dataChannel;
  const peer = new wrtc.RTCPeerConnection(configuration);
  peer.ondatachannel = (event) => {
    dataChannel = event.channel;
    dataChannel.onopen = () => {
      console.log("opened");
    };
    dataChannel.onclose = (event) => {
      console.log("closed");
    };
    dataChannel.onmessage = (event) => {
      console.log("messaged");
      console.log(event);
    };
  };
  peer.onconnectionstatechange = () => {
    console.log("Connection state:", peer.connectionState);
  };
  peer.onsignalingstatechange = () => {
    console.log("Signaling state:", peer.signalingState);
  };
  peer.oniceconnectionstatechange = () => {
    console.log("ICE connection state:", peer.iceConnectionState);
  };
  peer.onicegatheringstatechange = () => {
    console.log("ICE gathering state:", peer.iceGatheringState);
  };
  peer.onicecandidate = (event: any) => {
    console.log("onicecandidate");
    if (event.candidate) {
      localCandidates.push(event.candidate);
      return;
    }
    let payload = {
      answer: peer.localDescription,
      candidates: localCandidates,
    };
    onAnswer(payload);
  };
  await peer.setRemoteDescription(offer);
  let answer = await peer.createAnswer();
  await peer.setLocalDescription(answer);
  for (let candidate of candidates) {
    if (!candidate.candidate) continue;
    console.log({ candidate });
    await peer.addIceCandidate(candidate);
  }
}

const app = express() as unknown as expressWs.Application;
expressWs(app);

app.use(express.json());
app.use((req, res, next) => {
  res.header("x-robots-tag", "noindex");
  res.header("access-control-allow-headers", "*");
  res.header("access-control-allow-origin", "*");
  res.header("access-control-allow-methods", "*");
  res.header("access-control-expose-headers", "*");
  next();
});

app.post("/connect", (req, res) => {
  const data = req.body;
  if (data && data.offer && data.localCandidates) {
    const { offer, localCandidates } = data;
    let didAnswer = false;
    connect(offer, localCandidates, (answer) => {
      if (!didAnswer) {
        didAnswer = true;
        res.json(answer);
      }
    });
  }
});

const forbiddenForwardHeaders: string[] = [
  "connection",
  "transfer-encoding",
  "host",
  "connection",
  "origin",
  "referer",
];

const forbiddenPassHeaders: string[] = [
  "vary",
  "connection",
  "transfer-encoding",
  "access-control-allow-headers",
  "access-control-allow-methods",
  "access-control-expose-headers",
  "access-control-max-age",
  "access-control-request-headers",
  "access-control-request-method",
];

// common defaults
const defaultForwardHeaders: string[] = ["accept-encoding", "accept-language"];

const defaultPassHeaders: string[] = [
  "content-encoding",
  "content-length",
  "last-modified",
];

// defaults if the client provides a cache key
const defaultCacheForwardHeaders: string[] = [
  "if-modified-since",
  "if-none-match",
  "cache-control",
];

const defaultCachePassHeaders: string[] = ["cache-control", "etag"];

const cacheNotModified = 304;

export interface BareErrorBody {
  code: string;
  id: string;
  message?: string;
  stack?: string;
}

export class BareError extends Error {
  status: number;
  body: BareErrorBody;
  constructor(status: number, body: BareErrorBody) {
    super(body.message || body.code);
    this.status = status;
    this.body = body;
  }
}

interface BareServerOptions {
  logErrors: boolean;
  /**
   * Callback for filtering the remote URL.
   * @returns Nothing
   * @throws An error if the remote is bad.
   */
  filterRemote?: (remote: Readonly<URL>) => Promise<void> | void;
  /**
   * DNS lookup
   * May not get called when remote.host is an IP
   * Use in combination with filterRemote to block IPs
   */
  lookup: (
    hostname: string,
    options: LookupAllOptions,
    callback: (
      err: NodeJS.ErrnoException | null,
      addresses: LookupAddress[],
      family: number
    ) => void
  ) => void;
  localAddress?: string;
  family?: number;
  httpAgent: HTTPAgent;
  httpsAgent: HTTPSAgent;
  database: Map<string, string>;
}

export interface Address {
  address: string;
  family: number;
}

/**
 * Converts the address and family of a DNS lookup callback into an array if it wasn't already
 */
export function toAddressArray(address: string | Address[], family?: number) {
  if (typeof address === "string")
    return [
      {
        address,
        family,
      },
    ] as Address[];
  else return address;
}

const options: BareServerOptions = {
  logErrors: true,
  filterRemote: (url) => {
    // if the remote is an IP then it didn't go through the init.lookup hook
    // isValid determines if this is so
    if (isValid(url.hostname) && parse(url.hostname).range() !== "unicast")
      throw new RangeError("Forbidden IP");
  },
  lookup: (hostname, options, callback) =>
    lookup(hostname, options, (err, address, family) => {
      if (
        address &&
        toAddressArray(address, family).some(
          ({ address }) => parse(address).range() !== "unicast"
        )
      )
        callback(new RangeError("Forbidden IP"), [], -1);
      else callback(err, address, family);
    }),
  httpAgent: new HTTPAgent({
    keepAlive: true,
  }),
  httpsAgent: new HTTPSAgent({
    keepAlive: true,
  }),
  database: new Map<string, string>(),
};

export interface MetaV1 {
  v: 1;
  response?: {
    headers: ProtoBareHeaders;
  };
}

export interface MetaV2 {
  v: 2;
  response?: { status: number; statusText: string; headers: ProtoBareHeaders };
  sendHeaders: ProtoBareHeaders;
  remote: string;
  forwardHeaders: string[];
}

export default interface CommonMeta {
  value: MetaV1 | MetaV2;
  expires: number;
}

export class JSONDatabaseAdapter {
  impl: Map<string, string>;

  constructor(impl) {
    this.impl = impl;
  }
  async get(key: string) {
    const res = await this.impl.get(key);
    if (typeof res === "string") return JSON.parse(res) as CommonMeta;
  }
  async set(key: string, value: CommonMeta) {
    return await this.impl.set(key, JSON.stringify(value));
  }
  async has(key: string) {
    return await this.impl.has(key);
  }
  async delete(key: string) {
    return await this.impl.delete(key);
  }
  async *[Symbol.asyncIterator]() {
    for (const [id, value] of await this.impl.entries()) {
      yield [id, JSON.parse(value)] as [string, CommonMeta];
    }
  }
}

async function cleanupDatabase(database: Map<string, string>) {
  const adapter = new JSONDatabaseAdapter(database);

  for await (const [id, { expires }] of adapter)
    if (expires < Date.now()) database.delete(id);
}

const interval = setInterval(() => cleanupDatabase(options.database), 1000);

function outgoingError<T>(error: T): T | BareError {
  if (error instanceof Error) {
    switch ((<Error & { code?: string }>error).code) {
      case "ENOTFOUND":
        return new BareError(500, {
          code: "HOST_NOT_FOUND",
          id: "request",
          message: "The specified host could not be resolved.",
        });
      case "ECONNREFUSED":
        return new BareError(500, {
          code: "CONNECTION_REFUSED",
          id: "response",
          message: "The remote rejected the request.",
        });
      case "ECONNRESET":
        return new BareError(500, {
          code: "CONNECTION_RESET",
          id: "response",
          message: "The request was forcibly closed.",
        });
      case "ETIMEOUT":
        return new BareError(500, {
          code: "CONNECTION_TIMEOUT",
          id: "response",
          message: "The response timed out.",
        });
    }
  }

  return error;
}

export async function bareFetch(
  request: HTTPRequestPayload,
  signal: AbortSignal,
  remote: URL,
  options: BareServerOptions
): Promise<IncomingMessage> {
  if (options.filterRemote) await options.filterRemote(remote);

  const req: RequestOptions = {
    method: request.method,
    headers: request.requestHeaders,
    setHost: false,
    signal,
    localAddress: options.localAddress,
    family: options.family,
    lookup: options.lookup,
  };

  let outgoing: ClientRequest;

  // NodeJS will convert the URL into HTTP options automatically
  // see https://github.com/nodejs/node/blob/e30e71665cab94118833cc536a43750703b19633/lib/internal/url.js#L1277

  if (remote.protocol === "https:")
    outgoing = httpsRequest(remote, {
      ...req,
      agent: options.httpsAgent,
    });
  else if (remote.protocol === "http:")
    outgoing = httpRequest(remote, {
      ...req,
      agent: options.httpAgent,
    });
  else throw new RangeError(`Unsupported protocol: '${remote.protocol}'`);

  if (request.body) Readable.from([request.body]).pipe(outgoing);
  else outgoing.end();

  return await new Promise((resolve, reject) => {
    outgoing.on("response", (response: IncomingMessage) => {
      resolve(response);
    });

    outgoing.on("upgrade", (req, socket) => {
      reject("Remote did not send a response");
      socket.destroy();
    });

    outgoing.on("error", (error: Error) => {
      reject(outgoingError(error));
    });
  });
}

class Client {
  send: (msg: Buffer) => void;
  events: EventEmitter;

  constructor(send) {
    this.send = send;
    this.events = new EventEmitter();
  }

  static parseMsgInit(
    msg: Buffer
  ): { cursor: number; seq: number; op: number } | undefined {
    try {
      let cursor = 0;
      const seq = msg.readUint16BE(cursor);
      cursor += 2;
      const op = msg.readUint8(cursor);
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
    payloadRaw: Buffer
  ): HTTPRequestPayload | undefined {
    let payload;
    try {
      payload = JSON.parse(payloadRaw.toString());
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
    body: Buffer;
  } {
    return {
      payload: {
        status: e.status,
        statusText: STATUS_CODES[e.status] || "",
        headers: {},
      },
      body: Buffer.from(JSON.stringify(e.body)),
    };
  }

  async handleHTTPRequest(payload: HTTPRequestPayload): Promise<{
    payload: HTTPResponsePayload;
    body: Buffer;
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
    const buffers: any[] = [];

    // node.js readable streams implement the async iterator protocol
    for await (const data of resp) {
      buffers.push(data);
    }
    const body = Buffer.concat(buffers);

    return {
      payload: {
        status: resp.statusCode || 500,
        statusText: resp.statusMessage || "",
        headers: Object.fromEntries(
          Object.entries(resp.headersDistinct).filter(([k, v]) => Boolean(v))
        ) as ProtoBareHeaders,
      },
      body,
    };
  }

  sendHTTPResponse(seq: number, payload: HTTPResponsePayload, body: Buffer) {
    const payloadBuffer = Buffer.from(JSON.stringify(payload));
    const buf = Buffer.alloc(2 + 2 + 4 + payloadBuffer.length + body.length);
    let cursor = 0;
    cursor += buf.writeUInt16BE(seq, cursor);
    cursor += buf.writeUInt16BE(S2CRequestTypes.HTTPResponse, cursor);
    cursor += buf.writeUInt32BE(payloadBuffer.length, cursor);
    cursor += payloadBuffer.copy(buf, cursor);
    body.copy(buf, cursor);
    this.send(buf);
  }

  async onMsg(msg: Buffer) {
    const init = Client.parseMsgInit(msg);
    if (!init) return;
    const { cursor, seq, op } = init;
    switch (op) {
      case C2SRequestTypes.HTTPRequest:
        let resp;
        const reqPayload = Client.parseHttpReqPayload(msg.subarray(cursor));
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
        this.sendHTTPResponse(seq, payload, body);
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

app.ws("/dev-ws", (ws, req) => {
  console.log("ws connect");
  const client = new Client((msg) => ws.send(msg));

  ws.on("message", (msg) => {
    if (typeof msg === "string") {
      msg = Buffer.from(msg);
    }

    if (msg instanceof Buffer) {
      client.onMsg(msg);
      return;
    }
    throw new Error("Unexpected message type");
  });
});

app.listen(3000, () => console.log("listening"));
