<script lang="ts">
  import { AdriftBareClient } from "../client/AdriftClient";
  import Connection from "../client/Connection";
  import { DevWsTransport } from "../client/DevWsTransport";
  import { RTCTransport } from "../client/RTCTransport";
  import type Transport from "../client/Transport";
  // note: even though we import firebase, due to the tree shaking, it will only run if we use "auth" so if ADRIFT_DEV is set it won't import
  import { auth } from "../firebase-config";
  import {
    BareClient,
    registerRemoteListener,
    setBareClientImplementation,
  } from "bare-client-custom";
  import { signInWithEmailAndPassword } from "firebase/auth";
  import { getDatabase, onValue, ref, set } from "firebase/database";

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
  async function connectFirebase() {
    if (!rtctransport) return;

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
      const data = snapshot.val();
      console.log(data);
      if (data && data.answer && data.candidates) {
        set(peer, null);
        const { answer, candidates } = JSON.parse(data);
        rtctransport?.answer(answer, candidates);
      }
    });
  }
</script>

<h1>
  {#if !import.meta.env.VITE_ADRIFT_DEV}
    <button on:click={connectFirebase}>Connect with firebase </button>
  {:else}
    connected to dev server
  {/if}
</h1>
