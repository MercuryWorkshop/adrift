<script lang="ts">
  import { setBareClientImplementation } from "bare-client-custom";
  import {
    AdriftBareClient,
    Connection,
    DevWsTransport,
    RTCTransport,
    SignalFirebase,
  } from "client";
  import {
    Button,
    Card,
    CircularProgressIndeterminate,
    Dialog,
    SegmentedButtonContainer,
    SegmentedButtonItem,
    StyleFromScheme,
    TextField,
  } from "m3-svelte";

  import iconDiscord from "@iconify-icons/ic/outline-discord";
  import iconGithub from "@iconify-icons/bi/github";
  import iconArrow from "@iconify-icons/maki/arrow";
  import Icon from "@iconify/svelte";

  import type { Transport } from "protocol";

  import Proxy from "./Proxy.svelte";
  import { initializeApp } from "firebase/app";

  import TrackerList from "tracker-list";

  enum ReadyState {
    Idle,
    Connecting,
    Connected,
  }
  let state = ReadyState.Idle;

  let transport: Transport;

  let rtctransport: RTCTransport | undefined;

  let email = "test@test.com";
  let password = "123456";

  let connectionState = "";

  let showSwarmWarning = false;
  let showLogin = false;
  let chosenTracker: keyof typeof TrackerList | undefined;

  function onTransportOpen() {
    console.log("Transport opened");

    let connection = new Connection(transport);
    let bare = new AdriftBareClient(connection);
    console.log(setBareClientImplementation);
    setBareClientImplementation(bare);
    state = ReadyState.Connected;
  }

  function onTransportClose() {
    console.warn("Transport closed");
  }

  function createRTCTransport() {
    let transport = new RTCTransport(
      onTransportOpen,
      onTransportClose,
      () => {
        connectionState = `Connection ${transport.peer.connectionState}...`;
      },
      () => {
        connectionState = `Signaling ${transport.peer.connectionState}...`;
      },
      () => {
        if (transport.peer.connectionState == "new") {
          connectionState = `Creating an offer...`;
        } else {
          connectionState = `Gathering ${transport.peer.connectionState}...`;
        }
      }
    );
    return transport;
  }

  async function initFirebase() {
    if (!chosenTracker) return;
    let tracker = TrackerList[chosenTracker];
    initializeApp(tracker.firebase);
  }

  async function connectAccount() {
    await initFirebase();
    rtctransport = transport = createRTCTransport();

    state = ReadyState.Connecting;
    let offer = await rtctransport.createOffer();
    connectionState = "Finding your node...";
    let answer = await SignalFirebase.signalAccount(
      JSON.stringify(offer),
      email,
      password
    );
    connectionState = "Linking to node...";
    await new Promise((r) => {
      setTimeout(r, 1000);
    });
    rtctransport.answer(answer.answer, answer.candidates);
  }

  async function connectSwarm() {
    await initFirebase();

    state = ReadyState.Connecting;

    rtctransport = transport = createRTCTransport();

    let offer = await rtctransport.createOffer();
    connectionState = "Routing you to an available node...";
    try {
      let answer = await SignalFirebase.signalSwarm(JSON.stringify(offer));

      connectionState = "Linking to node...";
      await new Promise((r) => {
        setTimeout(r, 500);
      });

      rtctransport.answer(answer.answer, answer.candidates);
    } catch (e) {
      console.error(e);
      connectionState = e;
    }
  }

  async function connectDevHttp() {
    rtctransport = transport = createRTCTransport();
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
</script>

{#if state == ReadyState.Connected}
  <Proxy />
{:else if state == ReadyState.Connecting}
  <div class="h-full w-full flex justify-center items-center">
    <Card type="outlined">
      <div class="flex items-center p-2">
        <CircularProgressIndeterminate />
        <div class="p-5" />
        <h2 class="text-xl">
          {connectionState}
        </h2>
      </div>
      <br />
      <p class="text-sm opacity-70">
        Adrift is routing you to a server available to take your requests.<br
        />The initial connection may take several minutes depending on server
        load
      </p>
    </Card>
  </div>
{:else if !import.meta.env.VITE_ADRIFT_DEV}
  <div id="topbar" class="flex justify-between items-center p-4">
    <div id="logo">
      <Card type="">
        <h3 class="text-xl">Adrift</h3>
      </Card>
    </div>
    <div id="nav">
      <!-- <Card type="outlined">
        <div id="quickmenu">
          <a href="httsp" class="text-med m-2">About</a>
          <a
            href="https://github.com/MercuryWorkshop/adrift"
            class="text-med m-2">Source</a
          >
        </div>
      </Card> -->
    </div>
    <div id="links">
      <Card type="elevated">
        <div class="flex">
          <a href="https://discord.gg/bAgNyGpXSx">
            <Icon icon={iconDiscord} class="icon" />
          </a>
          <spacer />
          <a href="https://github.com/MercuryWorkshop/adrift">
            <Icon icon={iconGithub} class="icon" />
          </a>
        </div>
      </Card>
    </div>
  </div>
  <div id="loginpage">
    <div class="flex justify-evenly">
      <Card type="filled">
        <SegmentedButtonContainer>
          {#each Object.keys(TrackerList) as tracker}
            <input
              type="radio"
              id={tracker}
              name="tabs"
              value={tracker}
              bind:group={chosenTracker}
            />
            <SegmentedButtonItem input={tracker}>{tracker}</SegmentedButtonItem>
          {/each}
        </SegmentedButtonContainer>

        {#if chosenTracker}
          <Button type="elevated" on:click={() => (showSwarmWarning = true)}
            >Connect to the swarm</Button
          >
          <Button type="filled" on:click={() => (showLogin = true)}
            >Connect with login</Button
          >
        {/if}

        <Dialog headline="WARNING" open={showSwarmWarning}>
          <h2 class="text-2xl">
            TLS has not currently been implemented for the Adrift Swarm. Your
            data will not be private, and you should not sign into any accounts
            that you care much about
          </h2>
          <br />
          <Button type="filled" on:click={() => (showLogin = false)}
            >Cancel</Button
          >
          <Button type="outlined" on:click={connectSwarm}
            >I understand, Connect</Button
          >
        </Dialog>

        <Dialog headline="Log in to Connect" open={showLogin}>
          <TextField name="email" bind:value={email} />
          <TextField
            name="password"
            bind:value={password}
            extraOptions={{ type: "password" }}
          />

          <div class="flex">
            <Button type="outlined" on:click={() => (showLogin = false)}
              >Cancel</Button
            >
            <Button type="filled" on:click={connectAccount}>Connect</Button>
          </div>
        </Dialog>
      </Card>
    </div>
  </div>
{:else}
  <div class="flex items-center justify-center h-full">
    <Card type="elevated">
      <div class="flex flex-col h-full">
        <h2 class="m3-font-headline-large m-3">Adrift DEV</h2>
        <div class="flex space-evenly pad-children">
          <Button type="filled" on:click={connectDevHttp}
            >Connect with WebRTC transport over localhost HTTP signaling</Button
          >
          <Button type="filled" on:click={connectDevWS}
            >Connect with localhost websocket transport</Button
          >
        </div>
      </div>
    </Card>
  </div>
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
  :global(.icon) {
    font-size: 2em;
  }
  :global(.pad-children > *) {
    margin: 2rem;
  }
  :global(#nav > *) {
    padding: 0.5em;
  }
  spacer {
    margin: 1em;
  }
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
</style>
