import { initializeApp, cert, ServiceAccount } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const serviceAccount = require('./serviceAccountKey.json');

initializeApp({
    credential: cert(serviceAccount as ServiceAccount),
});

const db = getFirestore();

async function regenerateUyeler() {
    const usersSnap = await db.collection('users').get();

    const promises = usersSnap.docs.map(async (docSnap) => {
        const data = docSnap.data();

        await db.collection('uyeler').doc(docSnap.id).set({
            email: data.email,
            name: data.name,
            role: data.role,
            isPresent: data.isPresent || false,
            ofis: data.companyID || 'default-company',
        });

        console.log(`📤 ${data.email} → uyeler koleksiyonuna aktarıldı.`);
    });

    await Promise.all(promises);
    console.log('✅ Tüm kullanıcılar uyeler koleksiyonuna geri yüklendi.');
}

regenerateUyeler().catch(console.error);
