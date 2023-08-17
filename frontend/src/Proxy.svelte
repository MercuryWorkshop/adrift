<script lang="ts">
  import { BareClient } from "bare-client-custom";
  import {
    Card,
    SegmentedButtonContainer,
    SegmentedButtonItem,
  } from "m3-svelte";
  import { Win, openWindow } from "../../corium";
  import Icon from "@iconify/svelte";

  let selectedProxy = "ultraviolet";

  let url: string = "http://google.com";

  import iconBack from "@iconify-icons/ic/outline-arrowback";
  import { onMount } from "svelte";

  let proxyIframe: HTMLIFrameElement;

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

<div class="h-full w-full flex flex-col">
  <div class="flex p-2">
    <div class="flex text-xl items-center w-full">
      <button>
        <Icon icon="fluent-mdl2:back" />
      </button>
      <div class="p-2" />
      <button>
        <Icon icon="fluent-mdl2:forward" />
      </button>
      <button
        class="text-2xl px-4"
        on:click={() => {
          console.log("a");
          visitURL(url);
        }}
      >
        <Icon icon="tabler:reload" />
      </button>
      <div id="urlbar" class="flex items-center flex-1">
        <div class="text-2xl px-2">
          <Icon icon="ic:round-search" />
        </div>
        <input
          bind:value={url}
          type="text"
          class="flex-1"
          on:keydown={(e) => {
            console.log(e);
            if (e.key === "Enter") {
              visitURL(url);
            }
          }}
        />
      </div>

      <button class="text-2xl pl-3">
        <Icon icon="ic:round-settings" />
      </button>
    </div>
    <!-- {#if !import.meta.env.VITE_ADRIFT_SINGLEFILE}
      <div>
        <SegmentedButtonContainer>
          <input
            type="radio"
            name="selectedProxy"
            bind:group={selectedProxy}
            value="ultraviolet"
            id="ultraviolet"
          />
          <SegmentedButtonItem input="ultraviolet"
            >Ultraviolet</SegmentedButtonItem
          >
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
    {/if} -->
  </div>
  <iframe class="flex-1" bind:this={proxyIframe} on:load={frameLoad} />
</div>

<style>
  #urlbar {
    border: solid 0.0625rem rgb(var(--m3-scheme-outline));
    padding: 0.5rem;
    border-radius: 0.75rem;
  }
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
