import dotenv from "dotenv";
import express from "express";
import expressWs from "express-ws";


import serviceAccount from "./admin-creds.json";

import admin, { ServiceAccount } from "firebase-admin";
import { WebSocket } from "ws";

import { v4 as uuid } from "uuid";

import { PROTOCOL_VERSION } from "protocol";

dotenv.config();

let members: Record<string, WebSocket> = {};


const app = express() as unknown as expressWs.Application;
expressWs(app);

app.use(express.json());
app.use((_req, res, next) => {
  res.header("x-robots-tag", "noindex");
  res.header("access-control-allow-headers", "*");
  res.header("access-control-allow-origin", "*");
  res.header("access-control-allow-methods", "*");
  res.header("access-control-expose-headers", "*");
  next();
});


admin.initializeApp({
  credential: admin.credential.cert(serviceAccount as ServiceAccount),
  databaseURL: process.env.DB_URL
});
let db = admin.database();
let reff = db.ref("/swarm");

reff.set({
  dummy: 1,
});

let ids: string[] = ["dummy"];

reff.on("value", snapshot => {
  let val = snapshot.val();
  console.log(val);
  if (!val) return;

  if (Object.keys(val) == ids) {
    return;
  }

  let newkeys = Object.keys(val).filter(id => id != "dummy" && !ids.includes(id));

  for (let key of newkeys) {
    let offer = val[key];
    console.log("new offer");

    if (Object.keys(members).length < 1) {
      db.ref(`/swarm/${key}`).set(JSON.stringify({ error: "no swarm members found" }));
      console.error("no swarm members!");
      return;
    }

    let selectedid = Object.keys(members)[Math.floor(Math.random() * Object.keys(members).length)];
    console.log("sending offer to " + selectedid);

    let selectedmember = members[selectedid];
    selectedmember.once("message", (answer) => {
      console.log("recieved answer");
      db.ref(`/swarm/${key}`).set(answer);
    });
    selectedmember.send(offer);

  }

  ids = ids.concat(newkeys);
});

app.get("/stats", (req, res) => {
  res.send({
    members: Object.keys(members)
  });
})

app.ws("/join", (ws, req) => {
  let ver = new URL(`https://a/${req.url}`).searchParams.get("protocol");

  if (ver != PROTOCOL_VERSION) {
    ws.close();
  }

  let id = uuid();
  console.log(req.ip);
  console.log(`ws connect of id ${id}`);

  members[id] = ws;

  ws.onclose = () => {
    console.log(`${req.ip} disconnected`);
    delete members[id];
  };
  setInterval(() => {
    ws.ping()
  }, 10000);
  ws.on("error", console.error);

});

app.listen(process.env.PORT, () => console.log("listening"));
