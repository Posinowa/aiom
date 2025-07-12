import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { readFileSync } from 'fs';
import path from 'path';

// JSON'u doğrudan okuyarak parse ediyoruz
const serviceAccountPath = path.resolve(__dirname, './serviceAccountKey.json');
const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));

initializeApp({
    credential: cert(serviceAccount),
});

const adminUid = 'kN4ThdVgGlhtUq0uLkqnrR6H7Lc2'; // ← BURAYA admin@ai.com UID'sini yaz

getAuth()
    .updateUser(adminUid, {
        emailVerified: true,
    })
    .then((userRecord) => {
        console.log('✅ Email verified:', userRecord.email);
    })
    .catch((error) => {
        console.error('❌ Hata:', error);
    });
