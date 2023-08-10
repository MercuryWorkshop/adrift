import { openWindow, deleteWindow } from "corium";
import { h, render, Component, Fragment } from 'preact';
import { RTCConnection } from "./rtc";

export default class App extends Component {
  rtc = new RTCConnection({
    onmessage: console.log,
    onopen: () => {
      this.rtc.dataChannel.send("test message");
    }
  });

  state = {


  };

  onInput = e => {
    const { value } = e.target;
    this.setState(prev => ({ ...prev, answer: value }));
  }

  render(props, state) {
    return <>
      <div>

      </div>

      <button onClick={async () => {
        console.log("whra");
        let offer = await this.rtc.createOffer();

        console.log("hra");
        this.setState(prev => ({ ...prev, offer: JSON.stringify(offer) }));


      }}>create offer</button>
      <p>
        offer: <code>{state.offer}</code>
      </p>

      paste answer: <input type="text" value={state.answer} onInput={this.onInput} />

      <button onClick={async () => {
        let { answer, candidates } = JSON.parse(state.answer);
        await this.rtc.answer(answer, candidates);
        alert("connected");
      }}>
        connect
      </button>

    </>;

  }
}
