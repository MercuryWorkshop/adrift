<script lang="ts">
  import {
    BareClient,
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

  import { Win, openWindow } from "../../corium";

  let transport: Transport;

  let wstransport: DevWsTransport | undefined;
  let rtctransport: RTCTransport | undefined;

  let email = "test@test.com";
  let password = "123456";

  let ready = false;

  let dynamic = false;

  let url: string;
  let proxyIframe: HTMLIFrameElement;

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
    console.log(setBareClientImplementation);
    setBareClientImplementation(bare);
    ready = true;
  }

  function onTransportClose() {
    console.warn("Transport closed");
  }

  async function connectFirebase() {
    rtctransport = transport = new RTCTransport(
      onTransportOpen,
      onTransportClose,
      console.log,
      console.log,
      console.log
    );

    let creds = await signInWithEmailAndPassword(auth, email, password);

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
    rtctransport = transport = new RTCTransport(
      onTransportOpen,
      onTransportClose,
      console.log,
      console.log,
      console.log
    );
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

  function visitURL(url: string) {
    if (!import.meta.env.VITE_ADRIFT_SINGLEFILE) {
      let path = dynamic
        ? `/service/route?url=${url}`
        : `${__uv$config.prefix}${__uv$config.encodeUrl(url)}`;
      console.log(dynamic);
      console.log(path);

      proxyIframe.src = path;
    } else {
      let bare = new BareClient();
      openWindow(
        new Request(url),
        "_self",
        proxyIframe.contentWindow! as unknown as Win,
        bare,
        "replace"
      );
    }
  }
  function frameLoad() {
    if (!import.meta.env.VITE_ADRIFT_SINGLEFILE) {
      url = __uv$config.decodeUrl(
        proxyIframe.contentDocument?.location.href.replace(/.*\//g, "")
      );
    }
  }

  (window as any).bare = new BareClient();

  (window as any).a = (_) => {
    let socket = bare.createWebSocket();

    socket.onopen = function (e) {
      alert("[open] Connection established");
      alert("Sending to server");
      socket.send("My name is John");
    };

    socket.onmessage = function (event) {
      alert(`[message] Data received from server: ${event.data}`);
    };

    socket.onclose = function (event) {
      if (event.wasClean) {
        alert(
          `[close] Connection closed cleanly, code=${event.code} reason=${event.reason}`
        );
      } else {
        // e.g. server process killed or network down
        // event.code is usually 1006 in this case
        alert("[close] Connection died");
      }
    };

    socket.onerror = function (error) {
      alert(`[error]`);
    };
  };
</script>

{#if ready}
  <div class="container h-full w-full">
    <div class="flex">
      <div class="container">
        <input bind:value={url} type="text" />
        <button on:click={() => visitURL(url)}>Go!</button>
      </div>
      <div class="container">
        <label>use dynamic?</label>
        <input type="checkbox" bind:value={dynamic} />
      </div>
    </div>
    <iframe class="h-full w-full" bind:this={proxyIframe} on:load={frameLoad} />
  </div>
{:else if !import.meta.env.VITE_ADRIFT_DEV}
  <div class="container">
    <label for="email">email</label>
    <input name="email" type="text" bind:value={email} />
    <label for="password">password</label>
    <input name="password" type="password" bind:value={password} />
    <button on:click={connectFirebase}>Connect with firebase</button>
  </div>
{:else}
  <button on:click={connectDevHttp}
    >Connect with dev webrtc (http signaling server)</button
  >
  <button on:click={connectDevWS}>Connect with dev websocket</button>
{/if}

<style>
  :global(body, html, #app) {
    width: 100vw;
    height: 100vh;
    padding: 0;
    margin: 0;
  }
  .flex {
    display: flex;
  }
  iframe {
    outline: none;
    border: none;
  }
  .container {
    display: flex;
    flex-direction: column;
    width: max-content;
  }
  .h-full {
    height: 100%;
  }
  .w-full {
    width: 100%;
  }
</style>
