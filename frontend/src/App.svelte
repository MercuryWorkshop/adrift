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
  import { Button, Card, StyleFromScheme, TextField } from "m3-svelte";
  // note: even though we import firebase, due to the tree shaking, it will only run if we use "auth" so if ADRIFT_DEV is set it won't import
  import { auth } from "firebase-config";
  import { signInWithEmailAndPassword } from "firebase/auth";
  import { getDatabase, onValue, ref, set } from "firebase/database";
  import type { Transport } from "protocol";

  import { Win, openWindow } from "../../corium";

  let transport: Transport;

  let rtctransport: RTCTransport | undefined;

  let email = "test@test.com";
  let password = "123456";

  let ready = false;

  let useDynamic = false;

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
    transport = new DevWsTransport(onTransportOpen, () =>
      console.log("onclose")
    );
  }

  function visitURL(url: string) {
    if (!import.meta.env.VITE_ADRIFT_SINGLEFILE) {
      let path = useDynamic
        ? `/service/route?url=${url}`
        : `${__uv$config.prefix}${__uv$config.encodeUrl(url)}`;
      console.log(useDynamic);
      console.log(path);

      proxyIframe.src = path;
    } else {
      let bare = new BareClient();
      openWindow(
        new Request(url),
        "_self",
        proxyIframe.contentWindow! as unknown as Win,
        bare as any,
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
  (window as any).myWsTest = () => {
    // const url = "wss://ws.postman-echo.com/raw";
    const url = "ws://127.0.0.1:3002/";
    const ws = ((window as any).ws = (
      (window as any).bare as BareClient
    ).createWebSocket(url, [], {}));
    ws.onopen = () => console.log("onopen");
    ws.addEventListener("open", () => console.log("open listener"));
    ws.onclose = () => console.error(new Error("onclose"));
    ws.addEventListener("close", (e) => console.log("close listener", e));
    ws.onmessage = (e) => console.log("message", e);
  };
</script>

{#if ready}
  <div class="container h-full w-full">
    <div class="flex">
      <div class="container">
        <input bind:value={url} type="text" />
        <button on:click={() => visitURL(url)}>Go!</button>
      </div>
      {#if !import.meta.env.VITE_ADRIFT_SINGLEFILE}
        <div>
          <label>use dynamic?</label>
          <input type="checkbox" bind:value={useDynamic} />
        </div>
      {/if}
    </div>
    <iframe class="h-full w-full" bind:this={proxyIframe} on:load={frameLoad} />
  </div>
{:else if !import.meta.env.VITE_ADRIFT_DEV}
  <div id="loginpage">
    <div class="bigcard">
      <h1>Adrift</h1>
    </div>

    <div class="flex justify-evenly">
      <Card type="filled">basically aero 2</Card>
      <div />
      <Card type="elevated">
        <TextField name="email" bind:value={email} />
        <TextField
          name="password"
          bind:value={password}
          extraOptions={{ type: "password" }}
        />

        <Button type="outlined" on:click={connectFirebase}
          >Connect with firebase</Button
        >
      </Card>
    </div>
  </div>
{:else}
  <Button type="tonal" on:click={connectDevHttp}
    >Connect with dev webrtc (http signaling server)</Button
  >
  <Button type="tonal" on:click={connectDevWS}
    >Connect with dev websocket</Button
  >
{/if}

<StyleFromScheme
  lightScheme={{
    primary: 1284831119,
    onPrimary: 4294967295,
    primaryContainer: 4293516799,
    onPrimaryContainer: 4280291399,
    inversePrimary: 4291804670,
    secondary: 4284636017,
    onSecondary: 4294967295,
    secondaryContainer: 4293451512,
    onSecondaryContainer: 4280162603,
    tertiary: 4286468704,
    onTertiary: 4294967295,
    tertiaryContainer: 4294957539,
    onTertiaryContainer: 4281405469,
    error: 4290386458,
    onError: 4294967295,
    errorContainer: 4294957782,
    onErrorContainer: 4282449922,
    background: 4294834175,
    onBackground: 4280097568,
    surface: 4294834175,
    onSurface: 4280097568,
    surfaceVariant: 4293386475,
    onSurfaceVariant: 4282991950,
    inverseSurface: 4281478965,
    inverseOnSurface: 4294307831,
    outline: 4286215551,
    outlineVariant: 4291478735,
    shadow: 4278190080,
    scrim: 4278190080,
    surfaceDim: 4292794592,
    surfaceBright: 4294834175,
    surfaceContainerLowest: 4294967295,
    surfaceContainerLow: 4294505210,
    surfaceContainer: 4294110452,
    surfaceContainerHigh: 4293715694,
    surfaceContainerHighest: 4293320937,
    surfaceTint: 4284831119,
  }}
  darkScheme={{
    primary: 1291804670,
    onPrimary: 4281739101,
    primaryContainer: 4283252085,
    onPrimaryContainer: 4293516799,
    inversePrimary: 4284831119,
    secondary: 4291543771,
    onSecondary: 4281544001,
    secondaryContainer: 4283057240,
    onSecondaryContainer: 4293451512,
    tertiary: 4293900488,
    onTertiary: 4283049266,
    tertiaryContainer: 4284693320,
    onTertiaryContainer: 4294957539,
    error: 4294948011,
    onError: 4285071365,
    errorContainer: 4287823882,
    onErrorContainer: 4294957782,
    background: 4279505432,
    onBackground: 4293320937,
    surface: 4279505432,
    onSurface: 4293320937,
    surfaceVariant: 4282991950,
    onSurfaceVariant: 4291478735,
    inverseSurface: 4293320937,
    inverseOnSurface: 4281478965,
    outline: 4287926169,
    outlineVariant: 4282991950,
    shadow: 4278190080,
    scrim: 4278190080,
    surfaceDim: 4279505432,
    surfaceBright: 4282071102,
    surfaceContainerLowest: 4279176467,
    surfaceContainerLow: 4280097568,
    surfaceContainer: 4280360740,
    surfaceContainerHigh: 4281018671,
    surfaceContainerHighest: 4281742394,
    surfaceTint: 4291804670,
  }}
/>

<style>
  #loginpage {
    padding: 2.5em;
  }
  .bigcard {
    background-color: rgb(var(--m3-scheme-primary-container));
    color: rgb(var(--m3-scheme-on-primary-container));
    border-radius: 2rem;

    display: flex;
    flex-direction: column;
    gap: 2rem;
    text-align: center;
    padding: 8rem 0 6rem 0;
    margin-bottom: 2rem;
  }
  :global(body, html, #app) {
    width: 100vw;
    height: 100vh;
    padding: 0;
    margin: 0;
    background-color: rgb(var(--m3-scheme-background));
    color: rgb(var(--m3-scheme-on-background));
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
