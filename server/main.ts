import dotenv from "dotenv";
import * as wrtc from "wrtc";

const configuration = {
  iceServers: [
    {
      urls: "stun:stun.l.google.com:19302",
    },
  ],
};
dotenv.config();

async function connect(offer, candidates) {
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
    let string = JSON.stringify(payload);
    console.log(string);
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

function addPeer(data) {
  if (data && data.offer && data.localCandidates) {
    const { offer, localCandidates } = data;
    connect(offer, localCandidates);
  }
}

addPeer({
  offer: {
    type: "offer",
    sdp: "v=0\r\no=mozilla...THIS_IS_SDPARTA-99.0 1516055380756088130 0 IN IP4 0.0.0.0\r\ns=-\r\nt=0 0\r\na=fingerprint:sha-256 A1:67:6E:32:56:AC:94:67:35:BF:55:F9:A5:53:F7:73:42:82:9F:85:80:F6:CA:FB:2E:97:52:04:42:2C:9E:E2\r\na=group:BUNDLE 0\r\na=ice-options:trickle\r\na=msid-semantic:WMS *\r\nm=application 9 UDP/DTLS/SCTP webrtc-datachannel\r\nc=IN IP4 0.0.0.0\r\na=sendrecv\r\na=ice-pwd:4e784021c6dce7679ceb6493b1fcaa15\r\na=ice-ufrag:8e234e4a\r\na=mid:0\r\na=setup:actpass\r\na=sctp-port:5000\r\na=max-message-size:1073741823\r\n",
  },
  localCandidates: [
    {
      candidate:
        "candidate:1 1 UDP 1686052863 64.98.208.26 44197 typ srflx raddr 0.0.0.0 rport 0",
      sdpMid: "0",
      sdpMLineIndex: 0,
      usernameFragment: "8e234e4a",
    },
    {
      candidate: "",
      sdpMid: "0",
      sdpMLineIndex: 0,
      usernameFragment: "8e234e4a",
    },
  ],
});
