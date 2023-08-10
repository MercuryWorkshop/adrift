import "preact/debug";
import { h, render } from 'preact'
import 'preact/devtools';
import App from "./App";


const container = document.getElementById("app") as HTMLElement;
let app = <App />;
console.log(app);
render(<App />, container);
