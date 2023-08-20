import { datadir } from "./lib";
import { spawn } from "child_process";
import fs from "fs";
import { https } from 'follow-redirects';
import chalk from "chalk";
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
                start();
            }, 2000);
        });
    })

function start() {
    console.log(chalk.blue(`Starting adrift...`));

    let child = spawn(`${dir}/${appname}`, [], { stdio: ["inherit", "inherit", "pipe"] });

    let errbuf = "";

    child.stderr!.on("data", e => {
        let err = e.toString();
        console.error(err);
        errbuf += err;
    });
    child.on("exit", (e) => {
        // upload `err` as telemetry?
        console.log(chalk.red(`Adrift crashed! exit code ${e}`));
        console.log(chalk.green("restarting in 3 seconds"));
        setTimeout(start, 3000);
    });
}