import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";

import { getDatabase, onValue, ref, set } from "firebase/database";
import { answerRtc } from "./rtc";

import { WebSocket } from "isomorphic-ws";

import { connectTracker } from "./server";

import { confirm, input, password } from "@inquirer/prompts";
import select from "@inquirer/select";
import boxen from "boxen";
import chalk from "chalk";

import TrackerList from "tracker-list";

import fs from "fs";
import { exit } from "process";
import { datadir } from "./lib";
import { PROTOCOL_VERSION } from "protocol";

export const SERVER_MILESTONE = "1.0";


async function config() {
    let dir = datadir();

    if (
        !(await confirm({
            message:
                "No config.json found. Would you like to go through first-time setup?",
        }))
    )
        exit(1);
    console.log(
        boxen(
            `${chalk.yellow("")}  ${chalk.blue(
                "Adrift Server Setup"
            )}  ${chalk.yellow("")}`,
            { padding: 1 }
        )
    );
    const tracker = (await select({
        message: "Select a central tracker",
        choices: Object.keys(TrackerList).map((name) => ({ name, value: name })),
    })) as keyof typeof TrackerList;
    const type = await select({
        message: "Select a central tracker",
        choices: [
            {
                value: "swarm",
                name: "Join global swarm",
                description:
                    "Allow requests from any Adrift user to connect to your server",
            },
            {
                value: "account",
                name: "Link to a personal account",
                description:
                    "Connect to your account, no one but you will be able to connect to the server",
            },
        ],
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
    };
    console.log(chalk.bold(`Writing choices to ${dir}/config.json...`));

    fs.writeFile(`${dir}/config.json`, JSON.stringify(conf), () => { });
    return conf;
}
async function login(credentials: any) {
    for (; ;) {
        credentials.email = await input({
            message: "Enter your account's email address",
        });
        credentials.password = await password({
            message: "Enter your account's password",
        });

        let auth = getAuth();
        try {
            let creds = await signInWithEmailAndPassword(
                auth,
                credentials.email,
                credentials.password
            );
            return creds;
        } catch (err) {
            console.error(chalk.red(`Error signing in: ${err.code}`));
        }
    }
}
async function start() {
    let dir = datadir();


    let conf;
    try {
        conf = JSON.parse(fs.readFileSync(`${dir}/config.json`).toString());
    } catch {
        conf = await config();
    }
    let tracker = TrackerList[conf.tracker as keyof typeof TrackerList];

    console.log(chalk.blue("Starting server!"));
    console.log(chalk.blue(`Server version: ${SERVER_MILESTONE} - Protocol version: ${PROTOCOL_VERSION}`));

    if (conf.type == "swarm") {
        let connect = () => {
            let trackerws = new WebSocket(`${tracker.tracker}/join?protocol=${PROTOCOL_VERSION}`);
            trackerws.onclose = () => {
                console.log(`Disconnected from tracker. Retrying...`);
                setTimeout(() => {
                    connect();
                }, 10000);
            };
            trackerws.onopen = () => {
                console.log(`Connected to tracker ${tracker.tracker}`);
            };
            connectTracker(trackerws);
        };
        connect();
    } else {
        initializeApp(tracker.firebase);

        let creds = await signInWithEmailAndPassword(
            getAuth(),
            conf.credentials.email,
            conf.credentials.password
        );

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
}


if (process.argv[2] != "--start") {
    console.error(chalk.red.bold("DO NOT LAUNCH THIS DIRECTLY, YOU SHOULD HAVE DOWNLOADED THE 'autoupdater' BINARY"))
    setTimeout(() => process.exit(1), 5000);
} else {
    start();
}