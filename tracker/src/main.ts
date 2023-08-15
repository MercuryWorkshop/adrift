import dotenv from "dotenv";
import express from "express";
import expressWs from "express-ws";


import serviceAccount from "./admin-creds.json";

import admin, { ServiceAccount } from "firebase-admin";
import { WebSocket } from "ws";

dotenv.config();

let members: WebSocket[] = [];


const app = express() as unknown as expressWs.Application;
expressWs(app);

app.use(express.json());


admin.initializeApp({
  credential: admin.credential.cert(serviceAccount as ServiceAccount),
  databaseURL: "https://adrift-6c1f6-default-rtdb.firebaseio.com"
});
let db = admin.database();
let reff = db.ref("/swarm");

reff.set({
  dummy: 1,
});

let ids: string[] = ["dummy"];

reff.on("value", snapshot => {
  let val = snapshot.val();
  if (!val) return;

  if (Object.keys(val) == ids) {
    return;
  }

  let newkeys = Object.keys(val).filter(id => id != "dummy" && !ids.includes(id));

  for (let key of newkeys) {
    let offer = val[key];
    console.log("new offer:" + offer);

    if (members.length < 1) {
      db.ref(`/swarm/${key}`).set(JSON.stringify({ error: "no swarm members found" }));
      console.error("no swarm members!");
      return;
    }

    let selectedmember = members[Math.floor(Math.random() * members.length)];

    selectedmember.once("message", (answer) => {
      db.ref(`/swarm/${key}`).set(answer);
    });
    selectedmember.send(offer);

  }

  ids = ids.concat(newkeys);
});


app.ws("/join", (ws, _req) => {

  console.log("ws connect");
  members.push(ws);

  ws.onclose = () => {
    members.filter(member => member != ws);
  };

});

app.listen(17776, () => console.log("listening"));
