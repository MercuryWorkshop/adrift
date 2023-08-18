import { datadir } from "./lib";
import { spawn } from "child_process";
import fs from "fs";
import { https } from 'follow-redirects';
let dir = datadir();
let platform = `${process.platform}-${process.arch}`
let appname = `adrift-server-${platform}`;
if (process.platform == "win32") {
    appname += ".exe";
}
https.get(
    `https://github.com/MercuryWorkshop/adrift/releases/latest/download/${appname}`, resp => {
        let file = fs.createWriteStream(`${dir}/${appname}`);
        resp.pipe(file);


        file.on("finish", () => {
            fs.chmodSync(`${dir}/${appname}`, "755");
            setTimeout(() => {
                // this timeout shouldn't be needed, but it is
                spawn(`${dir}/${appname}`, [], { stdio: "inherit" });
            }, 2000);
        });
    })