import dotenv from "dotenv";
import * as wrtc from "wrtc";


import { app } from "../firebase-config";
console.log(app);
import { getDatabase, ref, onValue, set } from "firebase/database";

const db = getDatabase();
let reff = ref(db, "/peers/demo");



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
    let string = JSON.stringify(payload)

    set(reff, string);
  };
  await peer.setRemoteDescription(offer);
  let answer = await peer.createAnswer();
  await peer.setLocalDescription(answer);
  for (let candidate of candidates) {
    await peer.addIceCandidate(candidate);
  }
}
onValue(reff, (snapshot) => {
  const rawdata = snapshot.val();

  let data = JSON.parse(rawdata);
  console.log(data);

  if (data && data.offer && data.localCandidates) {
    const { offer, localCandidates } = data;
    connect(offer, localCandidates);
  }
});

