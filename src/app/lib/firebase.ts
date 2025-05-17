

import { getFirestore } from 'firebase/firestore';
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';


const firebaseConfig = {
  apiKey: "AIzaSyCvSLwjWPRZLMCfZYwGs5ca25urMTkrt1E",
  authDomain: "ai-office-manager.firebaseapp.com",
  projectId: "ai-office-manager",
  storageBucket: "ai-office-manager.firebasestorage.app",
  messagingSenderId: "151704087021",
  appId: "1:151704087021:web:b64278f910c62f8fe6dfe4",
  measurementId: "G-J9276Y15QG"
};


const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
