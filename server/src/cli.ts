
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";


import { getDatabase, onValue, ref, set } from "firebase/database";
import { answerRtc } from "./rtc";

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
connectFirebase();