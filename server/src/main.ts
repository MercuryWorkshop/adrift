
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { initializeApp } from "firebase/app";


import { getDatabase, onValue, ref, set } from "firebase/database";
import { answerRtc } from "./rtc";

import { WebSocket } from "isomorphic-ws";

import TrackerList from "tracker-list";
import { connectTracker } from "./server";

async function connectFirebase() {
    let creds = await signInWithEmailAndPassword(getAuth(), "test@test.com", "123456");

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

let tracker = TrackerList["us-central-1"];
initializeApp(tracker.firebase);

let trackerws = new WebSocket(tracker.tracker + "/join");
connectTracker(trackerws);
connectFirebase();
console.log("main server, use dev server for dev server things");