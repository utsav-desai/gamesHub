import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-database.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyA9nQ41dC_suR3lTdTXJJI9uN7LSui0kKQ",
  authDomain: "gamehub-a8ec6.firebaseapp.com",
  databaseURL: "https://gamehub-a8ec6-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "gamehub-a8ec6",
  storageBucket: "gamehub-a8ec6.firebasestorage.app",
  messagingSenderId: "559408471339",
  appId: "1:559408471339:web:6c6650c673317907a2b96e"
};

export const isFirebaseConfigured = Object.values(firebaseConfig).every((value) => value && value !== "PASTE_HERE");
export const app = isFirebaseConfigured ? initializeApp(firebaseConfig) : null;
export const db = isFirebaseConfigured ? getDatabase(app) : null;
export const storage = isFirebaseConfigured ? getStorage(app) : null;
