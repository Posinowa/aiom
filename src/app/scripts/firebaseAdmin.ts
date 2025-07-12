// filepath: c:\Users\erent\Documents\projects\aiom\src\app\scripts\lib\firebaseAdmin.ts
import { initializeApp, applicationDefault, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const app = initializeApp({
    credential: applicationDefault(),
});

export const db = getFirestore(app);