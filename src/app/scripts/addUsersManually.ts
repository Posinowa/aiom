import { initializeApp, cert, ServiceAccount } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
const serviceAccount = require('./serviceAccountKey.json');

initializeApp({ credential: cert(serviceAccount as ServiceAccount) });
const db = getFirestore();

const users = [
    {
        id: "keremalparslan",
        email: "keremalparslan@gmail.com",
        name: "Kerem Alp Arlsan",
        role: "member",
        isAdmin: false,
        isPresent: false,
        companyID: "default-company",
    },
    // diğer kullanıcılar...
];

async function addUsers() {
    for (const user of users) {
        await db.collection('users').doc(user.id).set(user);
        console.log(`✅ Eklendi: ${user.email}`);
    }
}

addUsers().then(() => console.log("🔥 Tüm kullanıcılar eklendi."));
