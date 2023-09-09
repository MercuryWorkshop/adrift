<script lang="ts">
  import { BareClient } from "@mercuryworkshop/bare-client-custom";
  import { Win, openWindow } from "../../corium";
  import Icon from "@iconify/svelte";

  import { onMount } from "svelte";
  import {
    Dialog,
    SegmentedButtonContainer,
    SegmentedButtonItem,
    TextField,
  } from "m3-svelte";

  let url = "http://google.com";

  let proxyIframe: HTMLIFrameElement;

  let settingsenabled: boolean = false;

  let selectedProxy = "ultraviolet";

  let searchengine = "https://google.com/search?q=";

  function frameLoad() {
    if (!import.meta.env.VITE_ADRIFT_SINGLEFILE) {
      const location = proxyIframe.contentDocument?.location.href;
      if (location && location != "about:blank") {
        url = __uv$config.decodeUrl(
          proxyIframe.contentDocument?.location.href.replace(/.*\//g, "")
        );
      }
    }
  }

  function visitURL(url: string) {
    if (!url.includes("://")) {
      url = searchengine + url;
    }

    if (!import.meta.env.VITE_ADRIFT_SINGLEFILE) {
      let path =
        selectedProxy == "dynamic"
          ? `/service/route?url=${url}`
          : `${__uv$config.prefix}${__uv$config.encodeUrl(url)}`;

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
  onMount(() => {
    visitURL(url);
  });
</script>

<div class="h-full flex flex-col">
  <div class="flex p-2">
    <button
      class="text-2xl p-2 hover:text-primary"
      on:click={() => {
        proxyIframe.contentWindow?.history.back();
      }}
    >
      <Icon icon="ic:round-arrow-back" />
    </button>
    <button
      class="text-2xl p-2 hover:text-primary"
      on:click={() => {
        proxyIframe.contentWindow?.history.forward();
      }}
    >
      <Icon icon="ic:round-arrow-forward" />
    </button>
    <button
      class="text-2xl p-2 hover:text-primary"
      on:click={() => {
        visitURL(url);
      }}
    >
      <Icon icon="ic:round-refresh" />
    </button>
    <div class="flex flex-1 mx-2 border border-outline rounded-xl">
      <button
        class="text-2xl px-2 hover:text-primary"
        on:click={() => {
          visitURL(url);
        }}
      >
        <Icon icon="ic:round-search" />
      </button>
      <input
        bind:value={url}
        type="text"
        class="flex-1 w-0 pr-2 text-xl"
        on:keydown={(e) => {
          if (e.key === "Enter") {
            visitURL(url);
          }
        }}
      />
    </div>
    <button
      class="text-2xl p-2 hover:text-primary"
      on:click={() => (settingsenabled = true)}
    >
      <Icon icon="ic:round-settings" />
    </button>
  </div>
  <iframe class="flex-1" bind:this={proxyIframe} on:load={frameLoad} />
</div>
<Dialog bind:open={settingsenabled} headline="Proxy Settings">
  {#if !import.meta.env.VITE_ADRIFT_SINGLEFILE}
    <div>
      <SegmentedButtonContainer>
        <input
          type="radio"
          name="selectedProxy"
          bind:group={selectedProxy}
          value="ultraviolet"
          id="ultraviolet"
        />
        <SegmentedButtonItem input="ultraviolet">
          Ultraviolet
        </SegmentedButtonItem>
        <input
          type="radio"
          name="selectedProxy"
          bind:group={selectedProxy}
          value="dynamic"
          id="dynamic"
        />
        <SegmentedButtonItem input="dynamic">Dynamic</SegmentedButtonItem>
      </SegmentedButtonContainer>
    </div>
    <br />

    <TextField name="Default Search Engine" bind:value={searchengine} />
  {/if}
</Dialog>

<style>
  input {
    background-color: transparent;
    outline: none;
    border: none;
  }
  iframe {
    outline: none;
    border: none;
  }
</style>
