export declare abstract class Transport {
    onopen: () => void;
    onclose: () => void;
    ondata: (data: ArrayBuffer) => void;
    constructor(onopen: () => void, onclose: () => void);
    abstract send(data: ArrayBuffer): void;
    abstract close(): void;
}
