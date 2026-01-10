// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCl_IeTLlI1qV-mQNxA-DqOHOGc38Vf5K0",
  authDomain: "work-schedule-1f2e1.firebaseapp.com",
  projectId: "work-schedule-1f2e1",
  storageBucket: "work-schedule-1f2e1.firebasestorage.app",
  messagingSenderId: "793812364194",
  appId: "1:793812364194:web:3cf6bb1d8962f3cefa60fb",
  measurementId: "G-V86758XRXE"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);