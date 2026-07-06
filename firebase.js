import { initializeApp } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAY8lTf9ubAbSzjZ-iqlfFTaC7oAnRv8lg",
  authDomain: "sgms-cdd40.firebaseapp.com",
  projectId: "sgms-cdd40",
  storageBucket: "sgms-cdd40.firebasestorage.app",
  messagingSenderId: "414165913171",
  appId: "1:414165913171:web:d8f5e87538f6ab6b49c0a6"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
