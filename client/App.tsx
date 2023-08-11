import { Component, Fragment, h, render } from "preact";
import { RTCConnection } from "./rtc";

const _ = [h, render, Component, Fragment];
// import { setOffer, setCallback } from "./firebase";
import { BareClient as BareClientCustom, registerRemoteListener, setBareClientImplementation, Client, GetRequestHeadersCallback, MetaCallback, ReadyStateCallback, WebSocketImpl, BareHeaders, BareResponse } from "bare-client-custom";

import { createBareClient } from "@tomphttp/bare-client";


class AdriftClient extends Client {
  
  async request(method: string, requestHeaders: BareHeaders, body: BodyInit | null, remote: URL, cache: string | undefined, duplex: string | undefined, signal: AbortSignal | undefined): Promise<BareResponse> {
    return new Response("test") as BareResponse;
  }
  async connect(remote: URL, protocols: string[], getRequestHeaders: GetRequestHeadersCallback, onMeta: MetaCallback, onReadyState: ReadyStateCallback, webSocketImpl: WebSocketImpl): WebSocket {
    
  }
}


export default class App extends Component {
  rtc = new RTCConnection({
    onmessage: console.log,
    onopen: () => {
      this.rtc.dataChannel.send("test message");


      let client = new AdriftClient;
      setBareClientImplementation(client);


    }
  });

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
