import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";
import { getAuth, type Auth } from "firebase/auth";

export const firebaseConfig = {
  apiKey: "AIzaSyA3uzmkIR1nJV9vrBlsNGLGUUzRQZXlecU",
  authDomain: "sophy-print.firebaseapp.com",
  projectId: "sophy-print",
  storageBucket: "sophy-print.firebasestorage.app",
  messagingSenderId: "102832836431",
  appId: "1:102832836431:web:6cf61ae6daac1d9b02ff3a",
  measurementId: "G-0NPXYHVKVS",
};

export const app: FirebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const db: Firestore = getFirestore(app);
export const storage: FirebaseStorage = getStorage(app);
export const auth: Auth = getAuth(app);
