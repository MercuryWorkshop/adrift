const rtcConf = {
  iceServers: [
    {
      urls: "stun:stun.l.google.com:19302"
    }
  ]
}


type Offer = { offer: any, localCandidates: any };
interface RTCOptions {

  onconnectionstatechange?,
  onsignalingstatechange?,
  oniceconnectionstatechange?,
  onicegatheringstatechange?,
  onopen?,
  onclose?,
  onmessage?
}

export class RTCConnection {
  peer: RTCPeerConnection;

  dataChannel: RTCDataChannel;

  constructor(options: RTCOptions) {
    let {

      onconnectionstatechange,
      onsignalingstatechange,
      oniceconnectionstatechange,
      onicegatheringstatechange,
      onopen,
      onclose,
      onmessage
    } = options;

    this.peer = new RTCPeerConnection(rtcConf);
    this.peer.onconnectionstatechange = onconnectionstatechange;
    //   (event) => {
    //   console.log('Connection state:', this.peer.connectionState);
    // };
    this.peer.onsignalingstatechange = onsignalingstatechange;
    //   (event) => {
    //   console.log('Signaling state:', this.peer.signalingState);
    // };
    this.peer.oniceconnectionstatechange = oniceconnectionstatechange;
    //   (event) => {
    //   console.log('ICE connection state:', this.peer.iceConnectionState);
    //   if (this.peer.iceConnectionState == "disconnected" || this.peer.iceConnectionState == "failed") {
    //     console.log("disconnected");
    //     // ondisconnect();
    //   }
    // };
    this.peer.onicegatheringstatechange = onicegatheringstatechange;
    //   (event) => {
    //   console.log('ICE gathering state:', this.peer.iceGatheringState);
    // };

    this.dataChannel = this.peer.createDataChannel('host-server');
    this.dataChannel.onopen = onopen;
    //   () => {
    //   console.log("READY!!!");
    //
    //   dataChannel.send("test data");
    // };
    this.dataChannel.onclose = onclose;
    this.dataChannel.onmessage = onmessage;


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
