import { Component, Fragment, h, render } from "preact";
import { RTCConnection } from "./rtc";

const _ = [h, render, Component, Fragment];

export default class App extends Component {
  rtc = new RTCConnection({
    onmessage: console.log,
    onopen: () => {
      this.rtc.dataChannel.send("test message");
    },
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
