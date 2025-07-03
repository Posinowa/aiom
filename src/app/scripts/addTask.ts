import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
const serviceAccount = require('../../serviceAccountKey.json'); // konum doğruysa

initializeApp({
  credential: cert(serviceAccount),
});

const db = getFirestore();

async function addTask() {
  const taskRef = db.collection('tasks').doc('example_task_001'); // doc ID istersen otomatik de olabilir

  await taskRef.set({
    companyID: 'ai_office_001',
    yemekGorevListesi: [
      { gorev: 'Yemek Dağıtımı', sorumlu: 'uid_123' },
      { gorev: 'Tabak Toplama', sorumlu: 'uid_456' }
    ],
    temizlikGorevListesi: [
      { gorev: 'Yer Silme', sorumlu: 'uid_789' },
      { gorev: 'Çöp Atma', sorumlu: 'uid_321' }
    ],
    createdAt: new Date()
  });

  console.log('✅ Görev başarıyla eklendi.');
}

addTask().catch(console.error);
