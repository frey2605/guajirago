import { initializeApp } from "firebase/app";
import { getFirestore, enableIndexedDbPersistence } from "firebase/firestore";
import { getAuth, initializeAuth, browserLocalPersistence } from "firebase/auth";
import { getMessaging } from "firebase/messaging";
import { getStorage } from "firebase/storage";

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
export const auth = initializeAuth(app, { persistence: browserLocalPersistence });
auth.settings.appVerificationDisabledForTesting = false;
export const messaging = getMessaging(app);
export const storage = getStorage(app);

enableIndexedDbPersistence(db).catch(() => {});