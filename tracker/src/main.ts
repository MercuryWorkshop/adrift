import dotenv from "dotenv";
import express from "express";
import expressWs from "express-ws";


import serviceAccount from "./admin-creds.json";

import admin, { ServiceAccount } from "firebase-admin";

dotenv.config();


const app = express() as unknown as expressWs.Application;
expressWs(app);

app.use(express.json());


admin.initializeApp({
  credential: admin.credential.cert(serviceAccount as ServiceAccount),
  databaseURL: "https://adrift-6c1f6-default-rtdb.firebaseio.com"
});

app.ws("/join", (ws: any, _req: any) => {
  console.log(ws, _req);
});

app.listen(17776, () => console.log("listening"));
