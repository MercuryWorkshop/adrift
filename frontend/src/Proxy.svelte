<script lang="ts">
  import { BareClient } from "bare-client-custom";
  import { SegmentedButtonContainer, SegmentedButtonItem } from "m3-svelte";
  import { Win, openWindow } from "../../corium";

  let selectedProxy = "ultraviolet";

  let url: string = "http://google.com";

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
</script>

<div class="container h-full w-full">
  <div class="flex">
    <div class="container">
      <input bind:value={url} type="text" />
      <button on:click={() => visitURL(url)}>Go!</button>
    </div>
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
    {/if}
  </div>
  <iframe class="h-full w-full" bind:this={proxyIframe} on:load={frameLoad} />
</div>
