import dotenv from "dotenv";
import express from "express";
import expressWs from "express-ws";

import { signInWithEmailAndPassword } from "firebase/auth";
import wrtc from "wrtc";

import { auth } from "firebase-config";
import { getDatabase, onValue, ref, set } from "firebase/database";
import { AdriftServer } from "./server";

const configuration = {
  iceServers: [
    {
      urls: "stun:stun.l.google.com:19302",
    },
  ],
};
dotenv.config();

async function connect(
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

const app = express() as unknown as expressWs.Application;
expressWs(app);

app.use(express.json());
app.use((_req, res, next) => {
  res.header("x-robots-tag", "noindex");
  res.header("access-control-allow-headers", "*");
  res.header("access-control-allow-origin", "*");
  res.header("access-control-allow-methods", "*");
  res.header("access-control-expose-headers", "*");
  next();
});

function bufferToArrayBuffer(buf: Buffer): ArrayBuffer {
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
}

async function answerRtc(data: any, onrespond: (answer: any) => void) {
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
      server = new AdriftServer((msg) => dataChannel.send(msg));
    };
    dataChannel.onclose = () => {
      console.log("closed");
      server.onClose();
    };
    dataChannel.onmessage = (event) => {
      console.log("messaged");
      if (event.data instanceof Buffer) {
        server.onMsg(bufferToArrayBuffer(event.data));
      }
      throw new Error("Unexpected datachannel message type");
    };
  }
}

app.post("/connect", (req, res) => {
  const data = req.body;
  answerRtc(data, (d) => {
    res.json(d);
  });
});

app.ws("/dev-ws", (ws, _req) => {
  console.log("ws connect");
  const client = new AdriftServer((msg) => ws.send(msg));

  ws.on("message", (msg) => {
    if (typeof msg === "string") {
      msg = Buffer.from(msg);
    }

    if (msg instanceof Buffer) {
      client.onMsg(bufferToArrayBuffer(msg));
      return;
    }
    throw new Error("Unexpected message type");
  });
});

async function connectFirebase() {
  let creds = await signInWithEmailAndPassword(auth, "test@test.com", "123456");

  const db = getDatabase();
  let peer = ref(db, `/peers/${creds.user.uid}`);

  set(peer, "");

  onValue(peer, (snapshot) => {
    const str = snapshot.val();

    if (str) {
      let data = JSON.parse(str);
      console.log(data);
      console.log(data.offer);
      console.log(data.localCandidates);
      if (data && data.offer && data.localCandidates) {
        console.log("answerng");
        answerRtc(data, (answer) => {
          console.log("answering");
          set(peer, JSON.stringify(answer));
        });
      }
    }
  });
}
connectFirebase();

app.listen(3000, () => console.log("listening"));
