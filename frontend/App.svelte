<script lang="ts">
  import { AdriftBareClient } from "../client/AdriftClient";
  import Connection from "../client/Connection";
  import { DevWsTransport } from "../client/DevWsTransport";
  import { RTCTransport } from "../client/RTCTransport";
  import type Transport from "../client/Transport";
  import {
    BareClient,
    registerRemoteListener,
    setBareClientImplementation,
  } from "bare-client-custom";

  let transport: Transport;

  let wstransport: DevWsTransport | undefined;
  let rtctransport: RTCTransport | undefined;
  if (import.meta.env.VITE_ADRIFT_DEV) {
    console.log(
      "%cADRIFT RUNNING IN DEVELOPMENT MODE",
      "background: blue; color: white; font-size: x-large"
    );
    wstransport = transport = new DevWsTransport(
      () => console.log("onopen"),
      () => console.log("onclose")
    );
  } else {
    console.log(
      "%cADRIFT RUNNING IN PRODUCTION MODE",
      "background: blue; color: white; font-size: x-large"
    );
    rtctransport = transport = new RTCTransport(
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
  }

  let connection = new Connection(transport);

  let bare = new AdriftBareClient(connection);
  setBareClientImplementation(bare);
  if (!import.meta.env.VITE_ADRIFT_SINGLEFILE) {
    console.log("registering bare-client-custom");
    registerRemoteListener();
  }
</script>

<h1>testa</h1>
