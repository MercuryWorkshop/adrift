<script lang="ts">
  import {
    AdriftBareClient,
    Connection,
    DevWsTransport,
    RTCTransport,
  } from "client";
  // note: even though we import firebase, due to the tree shaking, it will only run if we use "auth" so if ADRIFT_DEV is set it won't import
  import { auth } from "firebase-config";
  import type { Transport } from "protocol";
  import {
    registerRemoteListener,
    setBareClientImplementation,
  } from "bare-client-custom";
  import { signInWithEmailAndPassword } from "firebase/auth";
  import { getDatabase, onValue, ref, set } from "firebase/database";

  let transport: Transport;

  let rtctransport: RTCTransport | undefined;
  if (import.meta.env.VITE_ADRIFT_DEV) {
    console.log(
      "%cADRIFT RUNNING IN DEVELOPMENT MODE",
      "background: blue; color: white; font-size: x-large"
    );
    transport = new DevWsTransport(
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
      const str = snapshot.val();
      if (str) {
        console.log(str);
        let data = JSON.parse(str);
        console.log(data);
        if (data && data.answer && data.candidates) {
          set(peer, null);
          const { answer, candidates } = data;
          rtctransport?.answer(answer, candidates);
        }
      }
    });
  }

  async function connectDevHttp() {
    let offer = await rtctransport?.createOffer();
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
    await rtctransport?.answer(answer, candidates);
  }
</script>

<h1>
  {#if !import.meta.env.VITE_ADRIFT_DEV}
    <button on:click={connectFirebase}>Connect with firebase </button>
  {:else}
    <button on:click={connectDevHttp}>Connect with dev HTTP</button>
  {/if}
</h1>
