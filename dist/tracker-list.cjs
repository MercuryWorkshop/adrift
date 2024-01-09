var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// tracker-list/src/index.ts
var src_exports = {};
__export(src_exports, {
  default: () => src_default
});
module.exports = __toCommonJS(src_exports);
var trackers = {
  "us-central-1": {
    firebase: {
      apiKey: "AIzaSyCs1LOqsbrAjymIcjvbKxPhFQWXlSPiLTs",
      authDomain: "adrift-6c1f6.firebaseapp.com",
      projectId: "adrift-6c1f6",
      storageBucket: "adrift-6c1f6.appspot.com",
      messagingSenderId: "175846512414",
      appId: "1:175846512414:web:5c6e06d231ab58e9029b0f",
      measurementId: "G-L0P2EF6Q72"
    },
    tracker: "wss://lb1.mercurywork.shop",
    description: "the official central tracker"
  },
  "rafftracker": {
    firebase: {
      apiKey: "AIzaSyDkcda0r-gdiJoTQ7EbOL9q7-NBQwiKlPg",
      authDomain: "rafftracker.firebaseapp.com",
      databaseURL: "https://rafftracker-default-rtdb.firebaseio.com",
      projectId: "rafftracker",
      storageBucket: "rafftracker.appspot.com",
      messagingSenderId: "994948039014",
      appId: "1:994948039014:web:f96970aa4f626e969dc8a7",
      measurementId: "G-PD96ZKX31D"
    },
    tracker: "wss://rafftracker.mercurywork.shop",
    description: "a second official backup tracker"
  }
};
var src_default = trackers;
