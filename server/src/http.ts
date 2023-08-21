import { LookupAddress, LookupAllOptions, Resolver, lookup, setServers } from "dns";
import {
  ClientRequest,
  Agent as HTTPAgent,
  IncomingMessage,
  RequestOptions,
  request as httpRequest,
} from "http";
import { Agent as HTTPSAgent, request as httpsRequest } from "https";
import fuck from "ipaddr.js";
import { HTTPRequestPayload } from "protocol";
const { isValid, parse } = fuck;

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

export const options: BareServerOptions = {
  logErrors: true,
  filterRemote: (url) => {
    // if the remote is an IP then it didn't go through the init.lookup hook
    // isValid determines if this is so
    if (isValid(url.hostname) && parse(url.hostname).range() !== "unicast")
      throw new RangeError("Forbidden IP");
  },
  lookup: (hostname, options, callback) => {
    setServers(["1.1.1.3", "1.0.0.3"]);

    lookup(hostname, options, (err: any, address: any, family: any) => {
      if (
        address &&
        toAddressArray(address, family).some(
          ({ address }) => parse(address).range() !== "unicast"
        )
      )
        callback(new RangeError("Forbidden IP"), [], -1);
      else callback(err, address, family);
    })
  },
  httpAgent: new HTTPAgent({
    keepAlive: true,
  }),
  httpsAgent: new HTTPSAgent({
    keepAlive: true,
  }),
  database: new Map<string, string>(),
};

export interface BareServerOptions {
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

export async function bareInitialFetch(
  request: HTTPRequestPayload,
  signal: AbortSignal,
  remote: URL,
  options: BareServerOptions
): Promise<ClientRequest> {
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

  return outgoing;
}

export async function fetchResponse(
  outgoing: ClientRequest
): Promise<IncomingMessage> {
  return await new Promise((resolve, reject) => {
    outgoing.on("response", (response: IncomingMessage) => {
      resolve(response);
    });

    outgoing.on("upgrade", (_req, socket) => {
      reject("Remote did not send a response");
      socket.destroy();
    });

    outgoing.on("error", (error: Error) => {
      reject(outgoingError(error));
    });
  });
}
