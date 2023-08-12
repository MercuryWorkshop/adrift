// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";

import { getAuth } from "firebase/auth";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCs1LOqsbrAjymIcjvbKxPhFQWXlSPiLTs",
  authDomain: "adrift-6c1f6.firebaseapp.com",
  projectId: "adrift-6c1f6",
  storageBucket: "adrift-6c1f6.appspot.com",
  messagingSenderId: "175846512414",
  appId: "1:175846512414:web:5c6e06d231ab58e9029b0f",
  measurementId: "G-L0P2EF6Q72"

};
console.warn("firebase is initializing");

// Initialize Firebase
export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
// export const analytics = getAnalytics(app);
