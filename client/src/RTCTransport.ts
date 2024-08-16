import { Transport } from "protocol";

const rtcConf = {
  iceServers: [
    {
      urls: "stun:stun.voip.blackberry.com:3478",
    },
  ],
};

export type Offer = { offer: any; localCandidates: any };
export type Answer = { answer: any; candidates: any };

export class RTCTransport extends Transport {
  peer: RTCPeerConnection;

  dataChannel: RTCDataChannel;
  constructor(
    public onopen: () => void,
    public onclose: () => void,
    public onconnectionstatechange: () => void,
    public onsignalingstatechange: () => void,
    public onicegatheringstatechange: () => void
  ) {
    super(onopen, onclose);
    this.peer = new RTCPeerConnection(rtcConf);
    this.peer.onconnectionstatechange = onconnectionstatechange;

    this.peer.onsignalingstatechange = onsignalingstatechange;

    this.peer.oniceconnectionstatechange = (event) => {
      console.log("ICE connection state:", this.peer.iceConnectionState);
      if (
        this.peer.iceConnectionState == "disconnected" ||
        this.peer.iceConnectionState == "failed"
      ) {
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

  send(data: ArrayBuffer) {
    this.dataChannel.send(data);
  }

  close() {
    this.dataChannel.close();
  }

  async createOffer(): Promise<Promise<Offer>> {
    const localCandidates: RTCIceCandidate[] = [];

    let readyPromise: Promise<Offer> = new Promise((resolve, reject) => {
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

  async answer(answer: any, candidates: any) {
    await this.peer.setRemoteDescription(answer);
    for (let candidate of candidates) {
      await this.peer.addIceCandidate(candidate);
    }
  }
}
