import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
const serviceAccount = require('../../serviceAccountKey.json');

initializeApp({
  credential: cert(serviceAccount),
});

const db = getFirestore();

async function addWeeklyTask() {
  const weeklyTaskRef = db.collection('weeklyTasks').doc(); // otomatik ID oluşturur

  await weeklyTaskRef.set({
    companyID: 'ai_office_001',
    date: new Date(), // bugünün tarihi

    yemekListesi: [
      { gorev: 'Yemek Dağıtımı', userID: 'uid_123' },
      { gorev: 'Servis Hazırlığı', userID: 'uid_456' },
    ],

    temizlikListesi: [
      { gorev: 'Yer Temizliği', userID: 'uid_789' },
      { gorev: 'Masa Silme', userID: 'uid_321' },
    ]
  });

  console.log('✅ Haftalık görev başarıyla eklendi.');
}

addWeeklyTask().catch(console.error);
