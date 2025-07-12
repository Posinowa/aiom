// src/app/scripts/fixTaskIDs.ts

import { db } from './firebaseAdmin'; // firebase-admin ile oluşturulmuş db

const companyID = 'AI Ofisi'; // ← Şirket ID’ni doğru yaz

const fixIDsInSubcollection = async (subPath: string) => {
    const colRef = db.collection(`tasks/${companyID}/${subPath}`);
    const snapshot = await colRef.get();

    if (snapshot.empty) {
        console.log(`❌ Boş koleksiyon: ${subPath}`);
        return;
    }

    for (const d of snapshot.docs) {
        const data = d.data();
        if (!data.id) {
            await d.ref.update({ id: d.id });
            console.log(`✅ ID eklendi → ${subPath}/${d.id}`);
        } else {
            console.log(`🔹 Zaten var → ${subPath}/${d.id}`);
        }
    }
};

const run = async () => {
    await fixIDsInSubcollection('temizlikGorevListesi');
    await fixIDsInSubcollection('yemekGorevListesi');
};

run();
