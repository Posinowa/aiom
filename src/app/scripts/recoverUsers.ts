import { initializeApp, cert, ServiceAccount } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const serviceAccount = require('./serviceAccountKey.json');

initializeApp({
    credential: cert(serviceAccount as ServiceAccount),
});

const db = getFirestore();

async function recoverUsers() {
    // Eğer uyeler koleksiyonu yoksa yeniden ekle
    const superAdminRef = db.collection('uyeler').doc('superadmin');
    const superAdminDoc = await superAdminRef.get();

    if (!superAdminDoc.exists) {
        await superAdminRef.set({
            email: 'superadmin@ai.com',
            name: 'Super Admin',
            role: 'superAdmin',
            ofis: 'default-company',
        });
        console.log('✅ superadmin@ai.com → uyeler koleksiyonuna eklendi');
    }

    const snapshot = await db.collection('uyeler').get();

    if (snapshot.empty) {
        console.log('⚠️ uyeler koleksiyonu boş, ekleme yapılamadı.');
        return;
    }

    const updates = snapshot.docs.map(async (docSnap) => {
        const data = docSnap.data();

        const newUserData = {
            email: data?.email || '',
            name: data?.name || '',
            role: data?.role || 'member',
            isPresent: data?.isPresent ?? false,
            companyID: data?.ofis || 'default-company',
            isAdmin: data?.role === 'admin',
        };

        await db.collection('users').doc(docSnap.id).set(newUserData);
        console.log(`✅ Aktarıldı: ${data.email}`);
    });

    await Promise.all(updates);
    console.log('🔥 Kurtarma tamamlandı. users koleksiyonu oluşturuldu.');
}

recoverUsers().catch(console.error);

export { };
