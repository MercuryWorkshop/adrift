import { Component, Fragment, h, render } from "preact";
import { RTCTransport } from "./RTCTransport";

const _ = [h, render, Component, Fragment];
import "./firebase";
import { BareClient as BareClientCustom, registerRemoteListener, setBareClientImplementation, Client, GetRequestHeadersCallback, MetaCallback, ReadyStateCallback, WebSocketImpl, BareHeaders, BareResponse } from "bare-client-custom";

import { createBareClient } from "@tomphttp/bare-client";
import { AdriftBareClient } from "./AdriftClient";
import Connection from "./Connection";

let rtc = new RTCTransport(
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
let connection = new Connection(rtc);
window["co"] = connection;
// connection.httprequest({ a: 1, b: 2 });

let bare = new AdriftBareClient(connection);
setBareClientImplementation(bare);
registerRemoteListener();


export default class App extends Component {
  rtc = rtc;

  state = {};

  onInput = (e) => {
    const { value } = e.target;
    this.setState((prev) => ({ ...prev, answer: value }));
  };

  render(props, state) {
    // setCallback(this.rtc.answer.bind(this.rtc));
    return (
      <>
        <div></div>
        <button
          onClick={async () => {
            let offer = await this.rtc.createOffer();
            console.log("offer created", offer);
            console.log(JSON.stringify(offer));

            const r = await fetch("http://localhost:3000/connect", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(offer),
            });
            if (r.status != 200) {
              throw new Error("connect: " + r.status + " " + r.statusText);
            }
            const { answer, candidates } = await r.json();
            await this.rtc.answer(answer, candidates);
            alert("connected");

            // setOffer(JSON.stringify(offer));

            // this.setState(prev => ({ ...prev, offer: JSON.stringify(offer) }));
          }}
        >
          create offer
        </button>
        <p>
          offer: <code>{state.offer}</code>
        </p>
        paste answer:{" "}
        <input type="text" value={state.answer} onInput={this.onInput} />
        <button
          onClick={async () => {
            let { answer, candidates } = JSON.parse(state.answer);
            await this.rtc.answer(answer, candidates);
            alert("connected");
          }}
        >
          connect
        </button>
      </>
    );
  }
}
