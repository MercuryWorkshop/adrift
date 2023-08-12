import dotenv from "dotenv";
import express from "express";
import expressWs from "express-ws";
import * as wrtc from "wrtc";
import { C2SRequestTypes } from "../protocol";

const configuration = {
  iceServers: [
    {
      urls: "stun:stun.l.google.com:19302",
    },
  ],
};
dotenv.config();

async function connect(
  offer,
  candidates,
  onAnswer: (answer: Record<string, any>) => void
) {
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
}

const app = express() as unknown as expressWs.Application;
expressWs(app);

app.use(express.json());
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  next();
});

app.post("/connect", (req, res) => {
  const data = req.body;
  if (data && data.offer && data.localCandidates) {
    const { offer, localCandidates } = data;
    let didAnswer = false;
    connect(offer, localCandidates, (answer) => {
      if (!didAnswer) {
        didAnswer = true;
        res.json(answer);
      }
    });
  }
});

class Client {
  send: (msg: Buffer) => void;

  constructor(send) {
    this.send = send;
  }

  static parseMsgInit(
    msg: Buffer
  ): { cursor: number; seq: number; op: number } | undefined {
    try {
      let cursor = 0;
      const seq = msg.readUint16BE(cursor);
      cursor += 2;
      const op = msg.readUint8(cursor);
      cursor += 1;
      return { cursor, seq, op };
    } catch (e) {
      if (e instanceof RangeError) {
        // malformed message
        return;
      }
      throw e;
    }
  }

  static parseHttpReqPayload(payloadRaw: Buffer) {
    let payload;
    try {
      payload = JSON.parse(payloadRaw.toString());
    } catch (e) {
      if (e instanceof SyntaxError) {
        return;
      }
      throw e;
    }
    console.log({ payload });
  }

  onMsg(msg: Buffer) {
    const init = Client.parseMsgInit(msg);
    if (!init) return;
    const { cursor, seq, op } = init;
    switch (op) {
      case C2SRequestTypes.HTTPRequest:
        Client.parseHttpReqPayload(msg.subarray(cursor));
        break;
      default:
        // not implemented
        break;
    }
  }
}

app.ws("/dev-ws", (ws, req) => {
  console.log("ws connect");
  const client = new Client((msg) => ws.send(msg));

  ws.on("message", (msg) => {
    if (typeof msg === "string") {
      msg = Buffer.from(msg);
    }

    if (msg instanceof Buffer) {
      client.onMsg(msg);
      return;
    }
    throw new Error("Unexpected message type");
  });
});

app.listen(3000, () => console.log("listening"));
