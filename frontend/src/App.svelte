<script lang="ts">
  import { setBareClientImplementation } from "bare-client-custom";
  import {
    AdriftBareClient,
    Connection,
    DevWsTransport,
    RTCTransport,
    SignalFirebase,
    downloadShortcut,
  } from "client";
  import {
    Button,
    Card,
    CircularProgressIndeterminate,
    Dialog,
    RadioAnim3,
    SnackbarAnim,
    StyleFromScheme,
    TextField,
  } from "m3-svelte";

  import iconDiscord from "@iconify-icons/ic/outline-discord";
  import iconGithub from "@iconify-icons/bi/github";

  import Icon from "@iconify/svelte";

  import type { Transport } from "protocol";

  import Proxy from "./Proxy.svelte";
  import { initializeApp } from "firebase/app";

  import TrackerList from "tracker-list";
  import {
    browserLocalPersistence,
    createUserWithEmailAndPassword,
    getAuth,
    setPersistence,
    signInWithEmailAndPassword,
  } from "firebase/auth";

  import logo from "./logo.png";
  import AccountCreation from "./AccountCreation.svelte";
  import { goOffline } from "firebase/database";

  enum ReadyState {
    Idle,
    Connecting,
    Connected,
    AccountCreation,
  }
  let state = ReadyState.Idle;

  let transport: Transport;

  let rtctransport: RTCTransport | undefined;

  let email = "";
  let password = "";

  let connectionState = "";

  let showSwarmWarning = false;
  let showLogin = false;
  type TrackerID = keyof typeof TrackerList;
  type Tracker = typeof TrackerList[TrackerID];

  let chosenTracker: TrackerID | undefined;

  let showTrackerList = false;

  let createaccount = false;

  let snackbar: (data: any) => void;

  async function onTransportOpen() {
    console.log("Transport opened");

    let connection = new Connection(transport);
    // TODO: error handling here
    await connection.initialize();
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
    let app = initializeApp(tracker.firebase);
  }

  async function connectAccount() {
    rtctransport = transport = createRTCTransport();

    state = ReadyState.Connecting;
    let offer = await rtctransport.createOffer();
    connectionState = "Finding your node...";
    let answer = await SignalFirebase.signalAccount(JSON.stringify(offer));
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

  let trackerstatuses: Partial<Record<TrackerID, object | null>> = {};
  for (let id in TrackerList) {
    let tracker = TrackerList[id as TrackerID];
    trackerstatuses[id as TrackerID] = null;

    let url = new URL(`${tracker.tracker}/stats`);
    url.protocol = "https://";
    fetch(url).then(async (data) => {
      trackerstatuses[id as TrackerID] = await data.json();
      console.log(trackerstatuses);
    });
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
  <div class="flex flex-col h-full">
    <div id="topbar" class="flex justify-between items-center p-4">
      <div id="logo">
        <Card type="">
          <div class="flex items-center text-3xl">
            <Icon icon="material-symbols:sailing" />
            <p class="text-2xl ml-3">Adrift</p>
          </div>
        </Card>
      </div>
      <div id="nav" />
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
    <div class="flex flex-col flex-1">
      <div class="flex m-4">
        <Card
          type="elevated"
          extraOptions={{ class: "m3-container type-elevated w-9/12" }}
        >
          <div class="w-full">
            <h2 class="text-6xl">Surf the web, Adrift</h2>
            <h2 class="text-2xl">
              A fast and modern decentralized proxy network
            </h2>
          </div>
          <div class="mt-5 flex justify-between">
            <Button type="filled" on:click={() => (showTrackerList = true)}
              >Start Browsing</Button
            >
            {#if !import.meta.env.VITE_ADRIFT_SINGLEFILE}
              <Button
                type="text"
                on:click={() => {
                  downloadShortcut("adrift.html", "Homework");
                }}>Get Shortcut</Button
              >
            {/if}
          </div>
        </Card>
      </div>
      <div
        class="flex h-full justify-end m-4 transition-all"
        class:opacity-0={!showTrackerList}
      >
        <Card
          type="elevated"
          extraOptions={{
            class: "m3-container type-elevated w-9/12 flex flex-col",
          }}
        >
          <h2 class="text-4xl">Select a Tracker</h2>
          <h2 class="text-1xl">Trackers allow you to connect to Adrift</h2>
          <div class="mt-5 space-y-3">
            {#each Object.keys(TrackerList) as tracker}
              <Card type="outlined">
                <label>
                  <div class="flex items-center">
                    <svelte:component this={RadioAnim3}>
                      <input
                        type="radio"
                        id={tracker}
                        name="tabs"
                        value={tracker}
                        bind:group={chosenTracker}
                      />
                    </svelte:component>
                    <p class="ml-3 text-xl">
                      {tracker}
                    </p>
                  </div>
                  <p>
                    {TrackerList[tracker].description}
                  </p>
                  <p class="opacity-50">
                    {trackerstatuses[tracker]
                      ? trackerstatuses[tracker]?.members?.length
                      : "loading"} swarm members
                  </p>
                </label>
              </Card>
            {/each}
          </div>
          <div class="flex-1" />
          <div class="mt-5 flex">
            {#if chosenTracker}
              <Button type="elevated" on:click={() => (showSwarmWarning = true)}
                >Connect to the swarm</Button
              >
              <Button
                type="filled"
                on:click={async () => {
                  await initFirebase();

                  let auth = getAuth();
                  await setPersistence(auth, browserLocalPersistence);

                  if (!auth.currentUser) {
                    showLogin = true;
                  } else {
                    await connectAccount();
                  }
                }}>Connect with login</Button
              >
            {/if}
          </div>

          <Dialog headline="WARNING" bind:open={showSwarmWarning}>
            <h2 class="text-2xl">
              TLS has not currently been implemented for the Adrift Swarm. It
              will later, but until then your data will not be private, and you
              should not enter any sensitive information on any page
            </h2>
            <br />
            <Button type="filled" on:click={() => (showLogin = false)}
              >Cancel</Button
            >
            <Button type="outlined" on:click={connectSwarm}
              >I understand, Connect</Button
            >
          </Dialog>

          <Dialog headline="Log in to connect" bind:open={showLogin}>
            <button
              class="text-primary my-3"
              on:click={() => ((createaccount = true), (showLogin = false))}
              >New here? Create an account</button
            >
            <br />
            <TextField name="email" bind:value={email} />
            <TextField
              name="password"
              bind:value={password}
              extraOptions={{ type: "password" }}
            />

            <div class="flex mt-5">
              <Button type="outlined" on:click={() => (showLogin = false)}
                >Cancel</Button
              >
              <Button
                type="filled"
                on:click={async () => {
                  try {
                    await signInWithEmailAndPassword(
                      getAuth(),
                      email,
                      password
                    );
                    connectAccount();
                  } catch (e) {
                    snackbar({ message: e, closable: true });
                  }
                }}>Connect</Button
              >
            </div>
          </Dialog>
          <Dialog bind:open={createaccount} headline="Create an account">
            <TextField name="email" bind:value={email} />
            <TextField
              name="password"
              bind:value={password}
              extraOptions={{ type: "password" }}
            />

            <p>
              Note: to be able to connect, you'll need to download an exit node
              and run it on a computer with an uncensored internet connection
            </p>

            <div class="flex mt-5">
              <Button
                type="filled"
                on:click={async () => {
                  try {
                    await createUserWithEmailAndPassword(
                      getAuth(),
                      email,
                      password
                    );
                    createaccount = false;
                  } catch (e) {
                    snackbar({ message: e, closable: true });
                  }
                }}>Create Account</Button
              >
            </div></Dialog
          >
        </Card>
      </div>
      <div class="flex m-4">
        <Card
          type="elevated"
          extraOptions={{ class: "m3-container type-elevated w-full" }}
        >
          <div class="flex space-x-10">
            <a class="text-1xl" href="https://mercurywork.shop"
              >© 2023 Mercury Workshop</a
            >

            <div class="space-x-3">
              <a class="text-1xl" href="https://discord.gg/bAgNyGpXSx"
                >discord</a
              >
              <a class="text-1xl" href="https://github.com/MercuryWorkshop"
                >github</a
              >
            </div>
            <div />
          </div>
        </Card>
      </div>
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
<svelte:component this={SnackbarAnim} bind:show={snackbar} />

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
  :global(body, html, #app) {
    width: 100vw;
    height: 100vh;
    padding: 0;
    margin: 0;
    background-color: rgb(var(--m3-scheme-background));
    color: rgb(var(--m3-scheme-on-background));
  }
</style>
