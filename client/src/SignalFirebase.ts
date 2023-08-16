import { getDatabase, onValue, ref, set, remove } from "firebase/database";
// import "firebase-config";

import { v4 as uuid } from "uuid";
import { Answer } from "./RTCTransport";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";


export async function signalSwarm(offer: string): Promise<Answer> {
  let id = uuid();
  const db = getDatabase();
  let reff = ref(db, `/swarm/${id}`);


  set(reff, offer);




  return new Promise((resolve, reject) => {


    onValue(reff, (snapshot) => {
      const text = snapshot.val();

      if (!text)
        return;
      let data = JSON.parse(text);
      console.log(data);

      if (data.error) {
        reject(new Error(data.error));
        return;
      }
      if (!(data && data.answer && data.candidates)) return;
      remove(reff);

      resolve(data);
    });

  });
}
export async function signalAccount(offer: string, email: string, password: string): Promise<Answer> {

  let auth = getAuth();
  let creds = await signInWithEmailAndPassword(auth, email, password);

  const db = getDatabase();
  let peer = ref(db, `/peers/${creds.user.uid}`);



  set(peer, offer);
  return new Promise((resolve, reject) => {

    onValue(peer, async (snapshot) => {
      const str = snapshot.val();
      if (str) {
        let data = JSON.parse(str);
        if (data && data.answer && data.candidates) {
          remove(peer);
          resolve(data);
        }
      }
    });
  });
}