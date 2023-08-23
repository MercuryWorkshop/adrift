let trackers = {
  "us-central-1": {
    firebase: {
      apiKey: "AIzaSyCs1LOqsbrAjymIcjvbKxPhFQWXlSPiLTs",
      authDomain: "adrift-6c1f6.firebaseapp.com",
      projectId: "adrift-6c1f6",
      storageBucket: "adrift-6c1f6.appspot.com",
      messagingSenderId: "175846512414",
      appId: "1:175846512414:web:5c6e06d231ab58e9029b0f",
      measurementId: "G-L0P2EF6Q72",
    },
    tracker: "wss://lb1.mercurywork.shop",
    description: "the official central tracker",
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
    description: "a second official backup tracker",
  }
} as const;
export default trackers;
