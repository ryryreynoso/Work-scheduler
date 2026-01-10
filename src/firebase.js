// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAfdwB2Cow8woA3Zmdv-hoZyI0rfGE8nm8",
  authDomain: "schedule-add.firebaseapp.com",
  projectId: "schedule-add",
  storageBucket: "schedule-add.firebasestorage.app",
  messagingSenderId: "375150033702",
  appId: "1:375150033702:web:2ac994dc0b875cbcdc5fe7",
  measurementId: "G-HMLY2TF5GV"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db = getFirestore(app);

export { db, analytics };