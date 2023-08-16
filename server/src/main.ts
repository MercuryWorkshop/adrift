
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { initializeApp } from "firebase/app";


import { getDatabase, onValue, ref, set } from "firebase/database";
import { answerRtc } from "./rtc";

import { WebSocket } from "isomorphic-ws";

import { connectTracker } from "./server";



import { input, confirm, password } from '@inquirer/prompts';
import select, { Separator } from '@inquirer/select';
import chalk from "chalk";
import boxen from "boxen";

import TrackerList from "tracker-list";

import fs from "fs";
import { exit } from "process";

async function config() {
    if (!await confirm({ message: "No config.json found. Would you like to go through first-time setup?" })) exit(1);
    console.log(boxen(`${chalk.yellow('')}  ${chalk.blue("Adrift Server Setup")}  ${chalk.yellow('')}`, { padding: 1 }))
    const tracker = await select({
        message: "Select a central tracker",
        choices: Object.keys(TrackerList).map(name => ({ name, value: name }))
    }) as keyof typeof TrackerList;
    const type = await select({
        message: "Select a central tracker",
        choices: [
            {
                value: "swarm",
                name: "Join global swarm",
                description: "Allow requests from any Adrift user to connect to your server"
            },
            {
                value: "account",
                name: "Link to a personal account",
                description: "Connect to your account, no one but you will be able to connect to the server"
            }
        ]
    });

    let credentials: any = {};
    if (type == "account") {
        initializeApp(TrackerList[tracker].firebase);
        await login(credentials);
    }


    let conf = {
        tracker,
        type,
        credentials,
    }
    console.log(chalk.bold("Writing choices to config.json..."))

    fs.writeFile("config.json", JSON.stringify(conf), () => { });
    return conf;
}
async function login(credentials: any) {
    for (; ;) {

        credentials.email = await input({ message: "Enter your account's email address" });
        credentials.password = await password({ message: "Enter your account's password" });

        let auth = getAuth();
        try {
            let creds = await signInWithEmailAndPassword(auth, credentials.email, credentials.password);
            return creds;
        } catch (err) {
            console.error(chalk.red(`Error signing in: ${err.code}`));
        }
    }
}
(async () => {
    let conf;
    try {
        conf = JSON.parse(fs.readFileSync("config.json").toString());
    } catch {
        conf = await config();
    }
    let tracker = TrackerList[conf.tracker as keyof typeof TrackerList];

    console.log(chalk.blue("Starting server!"));
    if (conf.type == "swarm") {
        let trackerws = new WebSocket(tracker.tracker + "/join");
        connectTracker(trackerws);
    } else {
        initializeApp(tracker.firebase);

        let creds = await signInWithEmailAndPassword(getAuth(), conf.credentials.email, conf.credentials.password);

        const db = getDatabase();
        let peer = ref(db, `/peers/${creds.user.uid}`);

        set(peer, "");

        onValue(peer, (snapshot) => {
            const str = snapshot.val();

            if (str) {
                let data = JSON.parse(str);
                if (data && data.offer && data.localCandidates) {
                    answerRtc(data, (answer) => {
                        console.log("answering");
                        set(peer, JSON.stringify(answer));
                    });
                }
            }
        });
    }
})();