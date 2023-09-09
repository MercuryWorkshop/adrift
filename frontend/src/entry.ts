if (import.meta.env.VITE_ADRIFT_CDN && import.meta.env.VITE_ADRIFT_SINGLEFILE) {
  document.body.innerHTML = `<link rel='stylesheet' href='https://cdn.jsdelivr.net/gh/adriftnet/static/index-861d7b8d.css' /> <link rel="stylesheet" href="https://fonts.googleapis.com/css?family=Cabin"><div id='app' />`;
}


import { registerRemoteListener } from "@mercuryworkshop/bare-client-custom";
import App from "./App.svelte";

import "./index.css";
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

const app = new App({
  target: document.getElementById("app")!,
});

if (!import.meta.env.VITE_ADRIFT_SINGLEFILE) {
  navigator.serviceWorker.register("/sw.js");
  console.log("registering bare-client-custom");
  registerRemoteListener();
}
export default app;
