import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import serviceAccountJson from '../../serviceAccountKey.json' assert { type: 'json' };
import { ServiceAccount } from 'firebase-admin';
const serviceAccount = serviceAccountJson as ServiceAccount;

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

async function addCompany() {
  const companyID = 'ai_office_001';
  const companyRef = db.collection('companies').doc(companyID);

  await companyRef.set({
    name: 'AI Ofisi',
    createdAt: new Date()
  });

  console.log('✅ Şirket başarıyla eklendi.');
}

addCompany().catch(console.error);
