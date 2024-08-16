const configuration = {
  iceServers: [
    {
      urls: "stun:stun.voip.blackberry.com:3478",
    },
  ],
};
import wrtc from "wrtc";
import { AdriftServer } from "./server";

export async function connect(
  offer: RTCSessionDescriptionInit,
  candidates: RTCIceCandidateInit[],
  onAnswer: (answer: Record<string, any>) => void
): Promise<RTCDataChannel> {
  const localCandidates: any[] = [];
  let dataChannel;
  const peer: RTCPeerConnection = new wrtc.RTCPeerConnection(configuration);
  let promise = new Promise((resolve) => {
    peer.ondatachannel = (event) => {
      dataChannel = event.channel;
      resolve(dataChannel);
    };
  });
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

  return promise as any;
}
export async function answerRtc(data: any, onrespond: (answer: any) => void) {
  if (data && data.offer && data.localCandidates) {
    const { offer, localCandidates } = data;
    let didAnswer = false;

    let dataChannel = await connect(offer, localCandidates, (answer) => {
      if (!didAnswer) {
        didAnswer = true;
        onrespond(answer);
        // res.json(answer);
      }
    });
    dataChannel.binaryType = "arraybuffer";

    let server: AdriftServer;

    dataChannel.onopen = () => {
      console.log("opened");
      server = new AdriftServer(
        (msg) => {
          if (dataChannel.readyState === "open") dataChannel.send(msg);
        },
        () => dataChannel.close()
      );
    };
    dataChannel.onclose = () => {
      console.log("closed");
      server.onClose();
    };
    dataChannel.onmessage = (event) => {
      if (!server) return;
      if (event.data instanceof ArrayBuffer) {
        server.onMsg(event.data);
        return;
      }
      if (event.data instanceof Buffer) {
        server.onMsg(bufferToArrayBuffer(event.data));
        return;
      }
      // ignore text and other types of messages
    };
  }
}
export function bufferToArrayBuffer(buf: Buffer): ArrayBuffer {
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
}
