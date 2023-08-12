<script lang="ts">
  import {
    registerRemoteListener,
    setBareClientImplementation,
  } from "bare-client-custom";
  import {
    AdriftBareClient,
    Connection,
    DevWsTransport,
    RTCTransport,
  } from "client";
  // note: even though we import firebase, due to the tree shaking, it will only run if we use "auth" so if ADRIFT_DEV is set it won't import
  import { auth } from "firebase-config";
  import { signInWithEmailAndPassword } from "firebase/auth";
  import { getDatabase, onValue, ref, set } from "firebase/database";
  import type { Transport } from "protocol";

  let transport: Transport;

  let wstransport: DevWsTransport | undefined;
  let rtctransport: RTCTransport | undefined;
  if (import.meta.env.VITE_ADRIFT_DEV) {
    console.log(
      "%cADRIFT RUNNING IN DEVELOPMENT MODE",
      "background: blue; color: white; font-size: x-large"
    );
  } else {
    console.log(
      "%cADRIFT RUNNING IN PRODUCTION MODE",
      "background: blue; color: white; font-size: x-large"
    );
  }

  if (!import.meta.env.VITE_ADRIFT_SINGLEFILE) {
    console.log("registering bare-client-custom");
    registerRemoteListener();
  }

  function onTransportOpen() {
    console.log("Transport opened");

    let connection = new Connection(transport);
    let bare = new AdriftBareClient(connection);
    setBareClientImplementation(bare);
  }

  function createRTCTransport() {
    rtctransport = transport = new RTCTransport(
      onTransportOpen,
      onTransportClose,
      console.log,
      console.log,
      console.log
    );
  }

  function onTransportClose() {
    console.warn("Transport closed");
  }

  async function connectFirebase() {
    createRTCTransport();

    let creds = await signInWithEmailAndPassword(
      auth,
      "test@test.com",
      "123456"
    );

    const db = getDatabase();
    let peer = ref(db, `/peers/${creds.user.uid}`);

    let offer = await rtctransport.createOffer();

    set(peer, JSON.stringify(offer));

    onValue(peer, (snapshot) => {
      const str = snapshot.val();
      if (str) {
        console.log(str);
        let data = JSON.parse(str);
        console.log(data);
        if (data && data.answer && data.candidates) {
          set(peer, null);
          const { answer, candidates } = data;
          rtctransport.answer(answer, candidates);
        }
      }
    });
  }

  async function connectDevHttp() {
    createRTCTransport();
    let offer = await rtctransport.createOffer();
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
    await rtctransport.answer(answer, candidates);
  }

  async function connectDevWS() {
    wstransport = transport = new DevWsTransport(onTransportOpen, () =>
      console.log("onclose")
    );
  }
</script>

<h1>
  {#if !import.meta.env.VITE_ADRIFT_DEV}
    <button on:click={connectFirebase}>Connect with firebase</button>
  {:else}
    <button on:click={connectDevHttp}
      >Connect with dev webrtc (http signaling server)</button
    >
    <button on:click={connectDevWS}>Connect with dev websocket</button>
  {/if}
</h1>
