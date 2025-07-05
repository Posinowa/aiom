import { initializeApp, cert, ServiceAccount } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const serviceAccount = require('./serviceAccountKey.json');

initializeApp({
    credential: cert(serviceAccount as ServiceAccount),
});

const db = getFirestore();

async function updateUsers() {
    const usersSnapshot = await db.collection('uyeler').get();

    const updates = usersSnapshot.docs.map(async (docSnap: FirebaseFirestore.DocumentSnapshot) => {
        const data = docSnap.data();

        const newUserData: any = {
            email: data?.email || '',
            name: data?.name || '',
            role: data?.role || 'member',
            isPresent: data?.isPresent ?? false,
            companyID: data?.ofis || 'default-company',
            isAdmin: data?.role === 'admin',
        };

        await db.collection('users').doc(docSnap.id).set(newUserData);
        console.log(`✅ Eklendi: ${data?.email}`);
    });

    await Promise.all(updates);
    console.log('🔥 Tüm kullanıcılar "users" koleksiyonuna taşındı.');
}

updateUsers().catch(console.error);

// ⛳ Bu satır dosyanın "module" olmasını sağlar:
export { };
