import { getDatabase, onValue, ref, set, remove } from "firebase/database";
// import "firebase-config";

import { v4 as uuid } from "uuid";
import { Answer } from "./RTCTransport";


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