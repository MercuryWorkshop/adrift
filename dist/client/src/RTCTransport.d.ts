import { Transport } from "protocol";
export type Offer = {
    offer: any;
    localCandidates: any;
};
export type Answer = {
    answer: any;
    candidates: any;
};
export declare class RTCTransport extends Transport {
    onopen: () => void;
    onclose: () => void;
    onconnectionstatechange: () => void;
    onsignalingstatechange: () => void;
    onicegatheringstatechange: () => void;
    peer: RTCPeerConnection;
    dataChannel: RTCDataChannel;
    constructor(onopen: () => void, onclose: () => void, onconnectionstatechange: () => void, onsignalingstatechange: () => void, onicegatheringstatechange: () => void);
    send(data: ArrayBuffer): void;
    close(): void;
    createOffer(): Promise<Promise<Offer>>;
    answer(answer: any, candidates: any): Promise<void>;
}
