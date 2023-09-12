<script lang="ts">
  import Icon from "@iconify/svelte";
  import { setBareClientImplementation } from "@mercuryworkshop/bare-client-custom";
  import {
    Button,
    Card,
    CircularProgressIndeterminate,
    StyleFromScheme,
  } from "m3-svelte";
  import {
    AdriftBareClient,
    Connection,
    DevWsTransport,
    RTCTransport,
    downloadShortcut,
  } from "client";
  import type { Transport } from "protocol";
  import Proxy from "./Proxy.svelte";
  import ConnectionCmp from "./Connection.svelte";
  import { UIState } from "./state";

  let state = UIState.Idle;
  let stateStr = "";

  let devTransport: Transport;
  async function onOpen() {
    console.log("[TRANSPORT DEV] opened");

    const connection = new Connection(devTransport);
    await connection.initialize();
    const bare = new AdriftBareClient(connection);
    setBareClientImplementation(bare);
    state = UIState.Connected;
  }
  async function connectDevHttp() {
    state = UIState.Connecting;
    const transport = new RTCTransport(
      onOpen,
      () => console.warn("[TRANSPORT] closed"),
      () => {
        stateStr = `Connection ${transport.peer.connectionState}...`;
      },
      () => {
        stateStr = `Signaling ${transport.peer.connectionState}...`;
      },
      () => {
        if (transport.peer.connectionState == "new") {
          stateStr = `Creating an offer...`;
        } else {
          stateStr = `Gathering ${transport.peer.connectionState}...`;
        }
      }
    );
    devTransport = transport;
    let offer = await transport.createOffer();
    console.log("offer", offer);

    const r = await fetch("http://localhost:3000/connect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(offer),
    });
    if (r.status != 200) {
      throw new Error("connect: " + r.status + " " + r.statusText);
    }
    const { answer, candidates } = await r.json();
    await transport.answer(answer, candidates);
  }
  async function connectDevWS() {
    state = UIState.Connecting;
    devTransport = new DevWsTransport(onOpen, () =>
      console.log("[TRANSPORT DEV] closed")
    );
  }
</script>

<svelte:head>
  <title>Adrift</title>
</svelte:head>

{#if state == UIState.Connected}
  <Proxy />
{:else if state == UIState.Connecting}
  <div class="h-full flex justify-center items-center">
    <Card type="outlined">
      <div class="flex items-center mb-4 gap-4">
        <CircularProgressIndeterminate />
        <h2 class="text-xl">{stateStr}</h2>
      </div>
      <p class="text-sm text-on-surface-variant">
        Adrift is routing you to a server available to take your requests.<br
        />The initial connection may take several minutes depending on server
        load
      </p>
    </Card>
  </div>
{:else if import.meta.env.VITE_ADRIFT_DEV}
  <div class="h-full flex justify-center items-center">
    <Card type="outlined">
      <h2 class="m3-font-headline-large mb-4">Adrift DEV</h2>
      <div class="flex gap-4">
        <Button type="filled" on:click={connectDevHttp}>
          Connect with localhost WebRTC transport over HTTP signaling
        </Button>
        <Button type="filled" on:click={connectDevWS}>
          Connect with localhost websocket transport
        </Button>
      </div>
    </Card>
  </div>
{:else}
  <div class="h-full flex flex-col p-6 gap-6 justify-center">
    <div class="flex justify-between items-center">
      <div class="flex gap-2 text-2xl">
        <Icon icon="material-symbols:sailing" />
        <p>Adrift</p>
      </div>
      <div class="flex flex-col text-center justify-end px-2">
        <p class="sm:text-xl lg:text-xl">
          A fast and modern decentralized proxy network
        </p>
      </div>
      <div class="">
        {#if !import.meta.env.VITE_ADRIFT_SINGLEFILE}
          <Button
            type="text"
            on:click={() => downloadShortcut("adrift.html", "Homework")}
          >
            Get shortcut
          </Button>
        {/if}
      </div>
    </div>
    <ConnectionCmp bind:state bind:stateStr />
    <Card type="elevated">
      <div class="flex gap-8 items-center">
        <a class="mr-auto" href="https://mercurywork.shop">
          © 2023 Mercury Workshop
        </a>

        <a href="https://discord.gg/bAgNyGpXSx" class="text-2xl">
          <Icon icon="ic:round-discord" />
        </a>
        <a href="https://github.com/MercuryWorkshop/adrift" class="text-2xl">
          <Icon icon="mdi:github" />
        </a>
      </div>
    </Card>
  </div>
{/if}

<StyleFromScheme
  lightScheme={{
    primary: 4282411062,
    onPrimary: 4294967295,
    primaryContainer: 4290834352,
    onPrimaryContainer: 4278198784,
    inversePrimary: 4289057685,
    secondary: 4283720525,
    onSecondary: 4294967295,
    secondaryContainer: 4292339917,
    onSecondaryContainer: 4279377678,
    tertiary: 4281886056,
    onTertiary: 4294967295,
    tertiaryContainer: 4290571246,
    onTertiaryContainer: 4278198306,
    error: 4290386458,
    onError: 4294967295,
    errorContainer: 4294957782,
    onErrorContainer: 4282449922,
    background: 4294507505,
    onBackground: 4279835927,
    surface: 4294507505,
    onSurface: 4279835927,
    surfaceVariant: 4292863191,
    onSurfaceVariant: 4282599487,
    inverseSurface: 4281217579,
    inverseOnSurface: 4293915368,
    outline: 4285757806,
    outlineVariant: 4291020988,
    shadow: 4278190080,
    scrim: 4278190080,
    surfaceDim: 4292402130,
    surfaceBright: 4294507505,
    surfaceContainerLowest: 4294967295,
    surfaceContainerLow: 4294112747,
    surfaceContainer: 4293717989,
    surfaceContainerHigh: 4293323232,
    surfaceContainerHighest: 4292994266,
    surfaceTint: 4282411062,
  }}
  darkScheme={{
    primary: 4294945779,
    onPrimary: 4284153947,
    primaryContainer: 4291690702,
    onPrimaryContainer: 4294967295,
    inversePrimary: 4289265833,
    secondary: 4294945779,
    onSecondary: 4284153947,
    secondaryContainer: 4286709890,
    onSecondaryContainer: 4294956533,
    tertiary: 4294947764,
    onTertiary: 4285005846,
    tertiaryContainer: 4292294218,
    onTertiaryContainer: 4294967295,
    error: 4294948011,
    onError: 4285071365,
    errorContainer: 4287823882,
    onErrorContainer: 4294957782,
    background: 4279702038,
    onBackground: 4293713893,
    surface: 4279702038,
    onSurface: 4293713893,
    surfaceVariant: 4283319371,
    onSurfaceVariant: 4291936971,
    inverseSurface: 4293713893,
    inverseOnSurface: 4281675315,
    outline: 4288318869,
    outlineVariant: 4283319371,
    shadow: 4278190080,
    scrim: 4278190080,
    surfaceDim: 4279702038,
    surfaceBright: 4282267452,
    surfaceContainerLowest: 4279373073,
    surfaceContainerLow: 4280293918,
    surfaceContainer: 4280557090,
    surfaceContainerHigh: 4281280557,
    surfaceContainerHighest: 4282004280,
    surfaceTint: 4294030310,
  }}
/>

<style>
  :global(body, html) {
    height: 100vh;
    margin: 0;
  }
</style>
