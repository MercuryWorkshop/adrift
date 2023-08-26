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
function downloadAndStart() {
    https.get(
        `https://github.com/MercuryWorkshop/adrift/releases/latest/download/${appname}`, resp => {
            let file = fs.createWriteStream(`${dir}/${appname}`);
            resp.pipe(file);


            file.on("finish", () => {
                fs.chmodSync(`${dir}/${appname}`, "755");
                // this timeout shouldn't be needed, but it is
                setTimeout(start, 2000);
            });
        })
}

function start() {
    console.log(chalk.blue(`Starting adrift...`));

    try {
        let child = spawn(`${dir}/${appname}`, ["--start"], { stdio: ["inherit", "inherit", "pipe"] });

        let errbuf = "";
        let timeout = setTimeout(() => {
            console.log(chalk.blueBright("server's been up for a while, attempting to update..."));
            child.removeAllListeners("exit");
            child.kill();
            downloadAndStart();
        }, 1000 * 60 * 60 * 4); // 4 hours

        child.stderr!.on("data", e => {
            let err = e.toString();
            console.error(err);
            errbuf += err;
        });
        child.on("exit", (e) => {
            // upload `err` as telemetry?
            console.log(chalk.red(`Adrift crashed! exit code ${e}`));
            console.log(chalk.green("restarting in 30 seconds"));

            clearTimeout(timeout);
            setTimeout(downloadAndStart, 30000);
        });
    } catch (e) {

        console.error(e);
        setTimeout(downloadAndStart, 30000);
    }

}

downloadAndStart();