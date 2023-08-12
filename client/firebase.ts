import "../firebase-config";
import { getDatabase, ref, onValue, set } from "firebase/database";


const db = getDatabase();
console.log(db);
let reff = ref(db, "/peers/demo");

// onValue(reff, (snapshot) => {
//   const data = snapshot.val();
//   console.log(data);
// });


var callback;
export function setCallback(call) {
  callback = call;
}
export function setOffer(offer: string) {
  set(reff, offer);
}


onValue(reff, (snapshot) => {
  const data = snapshot.val();
  console.log(data);

  if (data && data.answer && data.candidates) {
    set(reff, null);
    const { answer, candidates } = JSON.parse(data);
    callback(answer, candidates);
  }
});

