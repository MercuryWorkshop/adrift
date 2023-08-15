import {
  BareHeaders,
  BareResponse,
  Client,
  GetRequestHeadersCallback,
  MetaCallback,
  ReadyStateCallback,
  WebSocketImpl,
} from "bare-client-custom";
import { MAX_CHUNK_SIZE } from "protocol";
import { Connection } from "./Connection";

// https://fetch.spec.whatwg.org/#statuses
const NULL_BODY_STATUSES = [101, 103, 204, 205, 304];

/**
 * given a completely unknown body type, returns a stream that yields Uint8Arrays
 * below MAX_CHUNK_SIZE.
 */
function createBodyStream(
  body: BodyInit | null
): ReadableStream<ArrayBuffer | Uint8Array> | null {
  if (body === null || typeof body === "undefined") return null;

  if (typeof body === "string") {
    body = new TextEncoder().encode(body);
  }

  if (ArrayBuffer.isView(body)) {
    body = body.buffer.slice(
      body.byteOffset,
      body.byteOffset + body.byteLength
    );
  }

  if (body instanceof ArrayBuffer) {
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
      },
    });
  }

  if (body instanceof FormData) {
    throw new Error("formdata todo");
  }

  const transformer = () =>
    new TransformStream({
      transform: async (
        chunk: any,
        controller: TransformStreamDefaultController<Uint8Array>
      ) => {
        // attempt to transform a couple types into an ArrayBuffer
        if (typeof chunk === "string") {
          chunk = new TextEncoder().encode(chunk);
        }
        if (chunk instanceof Blob) {
          chunk = await chunk.arrayBuffer();
        }
        if (ArrayBuffer.isView(chunk)) {
          chunk = chunk.buffer.slice(
            chunk.byteOffset,
            chunk.byteOffset + chunk.byteLength
          );
        }

        // if none of those worked, give up.
        if (!(chunk instanceof ArrayBuffer)) {
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
      },
    });

  if (body instanceof ReadableStream) {
    return body.pipeThrough(transformer());
  }

  if (body instanceof Blob) {
    return body.stream().pipeThrough(transformer());
  }

  throw new Error("Unexpected body type: " + body);
}

export class AdriftBareClient extends Client {
  constructor(private connection: Connection) {
    super();
  }
  async request(
    method: string,
    requestHeaders: BareHeaders,
    body: BodyInit | null,
    remote: URL,
    cache: string | undefined,
    duplex: string | undefined,
    signal: AbortSignal | undefined
  ): Promise<BareResponse> {
    const bodyStream = createBodyStream(body);
    let { payload, body: respRawBody } = await this.connection.httprequest(
      {
        method,
        requestHeaders,
        remote,
      },
      bodyStream
    );
    const headers = new Headers();
    for (const [header, values] of Object.entries(payload.headers)) {
      for (const value of <string[]>values) {
        headers.append(header, value);
      }
    }

    let respBody: ArrayBuffer | null = respRawBody;
    if (
      respBody.byteLength == 0 ||
      NULL_BODY_STATUSES.includes(payload.status)
    ) {
      respBody = null;
    }

    return new Response(respBody, {
      status: payload.status,
      statusText: payload.statusText,
      headers,
    }) as BareResponse;
  }

  connect(
    remote: URL,
    protocols: string[],
    getRequestHeaders: GetRequestHeadersCallback,
    onMeta: MetaCallback,
    onReadyState: ReadyStateCallback,
    webSocketImpl: WebSocketImpl
  ): WebSocket {
    const ws = new webSocketImpl("ws:null", protocols);
    // this will error. that's okay
    let initalCloseHappened = false;
    ws.addEventListener("close", (e) => {
      if (!initalCloseHappened) {
        // we can freely mess with the fake readyState here because there is no
        //  readyStateChange listener for WebSockets
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

    let { send, close } = this.connection.wsconnect(
      remote,
      () => {
        onReadyState(WebSocket.OPEN);
        ws.dispatchEvent(new Event("open"));
      },
      (code: number, reason: string, wasClean: boolean) => {
        onReadyState(WebSocket.CLOSED);
        ws.dispatchEvent(new CloseEvent("close", { code, reason, wasClean }));
      },
      (data) => {
        ws.dispatchEvent(
          new MessageEvent("message", {
            data,
          })
        );
      },
      (message: string) => {
        console.log({ message });
        ws.dispatchEvent(new ErrorEvent("error", { message }));
      }
    );

    ws.send = (data: any) => {
      send(data);
    };

    ws.close = (code?: number, reason?: string) => {
      close(code, reason);
      onReadyState(WebSocket.CLOSING);
    };

    return ws;
  }
}
