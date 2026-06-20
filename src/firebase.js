import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getMessaging } from "firebase/messaging";

const firebaseConfig = {
  apiKey: "AIzaSyCP9QFCiJ-ugqpowMedEdabxTcg4tC0X2A",
  authDomain: "guajirago.firebaseapp.com",
  projectId: "guajirago",
  storageBucket: "guajirago.firebasestorage.app",
  messagingSenderId: "909490051480",
  appId: "1:909490051480:web:b762e1fe84f5bfc32873ed",
  measurementId: "G-QNFS5G335J"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const messaging = getMessaging(app);