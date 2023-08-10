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
    console.log('Connection state:', peer.connectionState);
  };
  peer.onsignalingstatechange = () => {
    console.log('Signaling state:', peer.signalingState);
  };
  peer.oniceconnectionstatechange = () => {
    console.log('ICE connection state:', peer.iceConnectionState);
  };
  peer.onicegatheringstatechange = () => {
    console.log('ICE gathering state:', peer.iceGatheringState);
  };
  peer.onicecandidate = (event: any) => {
    if (event.candidate) {
      localCandidates.push(event.candidate);
      return;
    }
    let payload = {
      answer: peer.localDescription,
      candidates: localCandidates,
    };
    console.log(JSON.stringify(payload));
  };
  await peer.setRemoteDescription(offer);
  let answer = await peer.createAnswer();
  await peer.setLocalDescription(answer);
  for (let candidate of candidates) {
    await peer.addIceCandidate(candidate);
  }
}

const { offer, localCandidates } =
  { "offer": { "type": "offer", "sdp": "v=0\r\no=- 4586812759771523024 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\na=group:BUNDLE 0\r\na=extmap-allow-mixed\r\na=msid-semantic: WMS\r\nm=application 9 UDP/DTLS/SCTP webrtc-datachannel\r\nc=IN IP4 0.0.0.0\r\na=ice-ufrag:c7ST\r\na=ice-pwd:gYK+MUVTy//4PeDk5hF7MPvG\r\na=ice-options:trickle\r\na=fingerprint:sha-256 74:57:8A:5F:E1:83:09:7F:56:5E:99:03:A7:2A:5D:0C:42:AC:8D:EB:00:33:43:E7:2B:3C:60:64:CD:B1:65:01\r\na=setup:actpass\r\na=mid:0\r\na=sctp-port:5000\r\na=max-message-size:262144\r\n" }, "localCandidates": [{ "candidate": "candidate:3436378122 1 udp 2113937151 152aa36b-1063-48ea-9d3d-0785d6d70eca.local 45909 typ host generation 0 ufrag c7ST network-cost 999", "sdpMid": "0", "sdpMLineIndex": 0, "usernameFragment": "c7ST" }, { "candidate": "candidate:3063087197 1 udp 1677729535 172.100.111.196 44745 typ srflx raddr 0.0.0.0 rport 0 generation 0 ufrag c7ST network-cost 999", "sdpMid": "0", "sdpMLineIndex": 0, "usernameFragment": "c7ST" }] }
connect(offer, localCandidates);
