<script lang="ts">
  import { initializeApp } from "firebase/app";
  import {
    Auth,
    browserLocalPersistence,
    createUserWithEmailAndPassword,
    getAuth,
    setPersistence,
    signInWithEmailAndPassword,
  } from "firebase/auth";
  import {
    Button,
    Dialog,
    Divider,
    ListItemLabel,
    RadioAnim2,
    SnackbarAnim,
    TextField,
  } from "m3-svelte";

  import { setBareClientImplementation } from "@mercuryworkshop/bare-client-custom";
  import {
    AdriftBareClient,
    Connection,
    RTCTransport,
    SignalFirebase,
  } from "client";
  import trackerList from "tracker-list";
  import { UIState } from "./state";

  type valueof<T> = T[keyof T];

  export let dialogConnection: boolean;
  let tlsWarningShown = false;
  let selectedTracker = Object.keys(trackerList)[0] as keyof typeof trackerList;

  let trackerStats: Record<string, any> = {};
  const getStats = async (tracker: valueof<typeof trackerList>) => {
    const url = new URL(`${tracker.tracker}/stats`);
    url.protocol = "https://";
    const resp = await fetch(url);

    return await resp.json();
  };
  Object.entries(trackerList).map(async ([trackerId, tracker]) => {
    const stats = await getStats(tracker);
    trackerStats[trackerId] = stats;
  });

  export let state: UIState;
  export let stateStr: string;
  let auth: Auth;
  let transport: RTCTransport;
  function createRTCTransport() {
    return new RTCTransport(
      async () => {
        stateStr = "Transport opened";
        console.log("[TRANSPORT] opened");

        const connection = new Connection(transport);
        await connection.initialize();
        const bare = new AdriftBareClient(connection);
        setBareClientImplementation(bare);
        state = UIState.Connected;
      },
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
  }
  function connectToApp(tracker: valueof<typeof trackerList>) {
    initializeApp(tracker.firebase);
    auth = getAuth();
  }
  async function connectSwarm() {
    connectToApp(trackerList[selectedTracker]);
    state = UIState.Connecting;

    transport = createRTCTransport();
    const offer = await transport.createOffer();
    stateStr = "Finding a node...";

    try {
      const answer = await SignalFirebase.signalSwarm(JSON.stringify(offer));
      stateStr = "Linking to the node...";

      transport.answer(answer.answer, answer.candidates);
    } catch (e) {
      console.error("While connecting to swarm", e);
      stateStr = e;
    }
  }

  let dialogAccount = false;
  let email = "";
  let password = "";
  let snackbar: (data: any) => void;
  async function connectNode() {
    state = UIState.Connecting;

    transport = createRTCTransport();
    const offer = await transport.createOffer();
    stateStr = "Finding your node...";

    let answer = await SignalFirebase.signalAccount(JSON.stringify(offer));
    stateStr = "Linking to the node...";
    transport.answer(answer.answer, answer.candidates);
  }
</script>

<Dialog bind:open={dialogConnection} headline="Connect to a tracker">
  <div class="flex flex-col -mx-4">
    {#each Object.entries(trackerList) as [trackerId, tracker], i}
      {#if i != 0}
        <Divider />
      {/if}
      <ListItemLabel
        headline={trackerId}
        supporting={trackerStats[trackerId]
          ? `${tracker.description} - ${
              trackerStats[trackerId].members.length
            } ${trackerStats[trackerId].members.length == 1 ? "node" : "nodes"}`
          : tracker.description}
      >
        <RadioAnim2 slot="leading">
          <input
            type="radio"
            name="tracker"
            bind:group={selectedTracker}
            value={trackerId}
          />
        </RadioAnim2>
      </ListItemLabel>
    {/each}
  </div>
  <p class="font-bold mt-4" class:hide-warning={!tlsWarningShown}>
    Your data is not end-to-end encrypted, and will not be private. While TLS
    will be implemented later, for now do not enter any private information.
    Click connect again to continue.
  </p>
  <svelte:fragment slot="buttons">
    <Button type="text" on:click={() => (dialogConnection = false)}>
      Cancel
    </Button>
    <Button
      type="text"
      on:click={() => {
        connectToApp(trackerList[selectedTracker]);
        setPersistence(auth, browserLocalPersistence);
        console.log(browserLocalPersistence, auth.currentUser);

        if (auth.currentUser) {
          connectNode();
        } else {
          dialogConnection = false;
          dialogAccount = true;
        }
      }}
    >
      Connect to your node
    </Button>
    <Button
      type="tonal"
      on:click={() => {
        if (tlsWarningShown) {
          connectSwarm();
          dialogConnection = false;
        }
        tlsWarningShown = true;
      }}
    >
      Connect
    </Button>
  </svelte:fragment>
</Dialog>
<Dialog bind:open={dialogAccount} headline="Sign in">
  <div class="flex gap-4 flex-col">
    <TextField name="Email" bind:value={email} />
    <TextField
      name="Password"
      bind:value={password}
      extraOptions={{ type: "password" }}
    />
  </div>
  <svelte:fragment slot="buttons">
    <Button type="text" on:click={() => (dialogAccount = false)}>Cancel</Button>
    <Button
      type="text"
      on:click={async () => {
        try {
          await createUserWithEmailAndPassword(auth, email, password);
          await connectNode();
        } catch (e) {
          snackbar({ message: e.message, closable: true });
        }
      }}
    >
      Sign up
    </Button>
    <Button
      type="text"
      on:click={async () => {
        try {
          await signInWithEmailAndPassword(auth, email, password);
          await connectNode();
        } catch (e) {
          snackbar({ message: e.message, closable: true });
        }
      }}
    >
      Log in
    </Button>
  </svelte:fragment>
</Dialog>
<SnackbarAnim bind:show={snackbar} />

<style>
  .hide-warning {
    margin: 0;
    height: 0;
    visibility: hidden;
  }
</style>
