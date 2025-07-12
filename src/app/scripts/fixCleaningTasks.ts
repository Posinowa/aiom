import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { ServiceAccount } from 'firebase-admin';
import serviceAccountJson from './serviceAccountKey.json' assert { type: 'json' };

const serviceAccount = serviceAccountJson as ServiceAccount;

initializeApp({
    credential: cert(serviceAccount),
});

const db = getFirestore();

async function migrateCleaningTasks() {
    const oldCollection = db.collection('temizlikGorevleri');
    const snapshot = await oldCollection.get();

    if (snapshot.empty) {
        console.log('❌ Hiç görev bulunamadı.');
        return;
    }

    console.log(`📦 Toplam ${snapshot.size} görev bulundu. Aktarılıyor...`);

    const cleanedTasks = [];

    for (const docSnap of snapshot.docs) {
        const data = docSnap.data();
        if (!data.companyID || !data.uid) {
            console.warn(`⚠️ Eksik bilgi: ${docSnap.id}`);
            continue;
        }

        cleanedTasks.push({
            atanan: data.atanan,
            uid: data.uid,
            email: data.email || '',
            tarih: data.tarih || Timestamp.now(),
            durum: data.durum || 'beklemede',
            yer: data.yer || '-',
            companyID: data.companyID,
        });
    }

    const docRef = db.doc('tasks/temizlikGorevleri');
    const existingSnap = await docRef.get();
    const existingData = existingSnap.exists ? existingSnap.data() : {};

    const currentList = existingData?.temizlikGorevListesi || [];

    await docRef.set({
        companyID: 'Al Ofisi',
        createdAt: existingData?.createdAt || Timestamp.now(),
        temizlikGorevListesi: [...currentList, ...cleanedTasks],
    });

    console.log(`✅ Aktarım tamamlandı. ${cleanedTasks.length} görev eklendi.`);
}

migrateCleaningTasks().catch(console.error);
