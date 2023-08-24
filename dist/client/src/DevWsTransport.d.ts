import { Transport } from "protocol";
export declare class DevWsTransport extends Transport {
    ws: WebSocket;
    constructor(onopen: () => void, onclose: () => void);
    onmessage(msg: MessageEvent<any>): void;
    send(data: ArrayBuffer): void;
    close(): void;
}
