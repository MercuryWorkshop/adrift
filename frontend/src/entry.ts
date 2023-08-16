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
}
export default app;
