import App from "./App.svelte";
import "./index.css";

const app = new App({
  target: document.getElementById("app")!,
});

if (!import.meta.env.VITE_ADRIFT_SINGLEFILE) {
  navigator.serviceWorker.register("/sw.js");
}
export default app;
