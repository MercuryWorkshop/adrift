import {
  BareClient,
  registerRemoteListener,
  setBareClientImplementation,
} from "bare-client-custom";
import { RTCTransport } from "./RTCTransport";
//import "./firebase";


import { AdriftBareClient } from "./AdriftClient";
import Connection from "./Connection";
import { DevWsTransport } from "./DevWsTransport";

const rtcEnable = false;

let rtc;
let connection;
if (rtcEnable) {
  rtc = new RTCTransport(
    console.log,
    () => {
      // rtc.dataChannel.send("test message");
      // let client = new AdriftBareClient;
      // setBareClientImplementation(client);
      //
    },
    console.log,
    console.log,
    console.log
  );
  connection = new Connection(rtc);
} else {
  connection = new Connection(
    new DevWsTransport(
      () => console.log("onopen"),
      () => console.log("onclose")
    )
  );
}

window["co"] = connection;
// connection.httprequest({ a: 1, b: 2 });

let bare = new AdriftBareClient(connection);
setBareClientImplementation(bare);
registerRemoteListener();

// if (import.meta.env.VITE_APP_ENV === 'development') {

            // if (rtcEnable) {
            //   let offer = await this.rtc.createOffer();
            //   console.log("offer created", offer);
            //   console.log(JSON.stringify(offer));
            //
            //   const r = await fetch("http://localhost:3000/connect", {
            //     method: "POST",
            //     headers: { "Content-Type": "application/json" },
            //     body: JSON.stringify(offer),
            //   });
            //   if (r.status != 200) {
            //     throw new Error("connect: " + r.status + " " + r.statusText);
            //   }
            //   const { answer, candidates } = await r.json();
            //   await this.rtc.answer(answer, candidates);
            //   alert("connected");
            // } else {
            //   window["bare"].fetch("https://httpbin.org/get");
            // }
            //
