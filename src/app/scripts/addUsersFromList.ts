import { initializeApp, cert, ServiceAccount } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const serviceAccount = require('./serviceAccountKey.json');

initializeApp({
    credential: cert(serviceAccount as ServiceAccount),
});

const db = getFirestore();

const users = [
    { email: 'keremalparslan@gmail.com', name: 'Kerem Alparslan' },
    { email: 'sumeyyedilaradogan@gmail.com', name: 'Sümeyye Dilara Yılmaz' },
    { email: 'ahmetarabaci20005@gmail.com', name: 'Ahmet Arabacı' },
    { email: 'muhammedrezancan@gmail.com', name: 'Muhammed Rezan Can' },
    { email: 'yusufyilmaz.f@gmail.com', name: 'Yusuf Yılmaz' },
    { email: 'agirmanberat668@gmail.com', name: 'Ahmet Berat Ağırman' },
    { email: 'halil10trkmn@gmail.com', name: 'Halil İbrahim Türkmen' },
    { email: 'idris.celik7265@gmail.com', name: 'İdris Çelik' },
    { email: 'erenturan685@gmail.com', name: 'Eren Turan' },
    { email: 'feyzanur788@gmail.com', name: 'Feyza Şahin' },
    { email: 'samedfenerli0650@gmail.com', name: 'Abdussamet Fenerli' },
    { email: 'esmanrshn00@gmail.com', name: 'Esma Şahin' },
];

async function addUsers() {
    for (const user of users) {
        const uid = user.email.split('@')[0];

        await db.collection('users').doc(uid).set({
            email: user.email,
            name: user.name,
            role: 'member',
            isAdmin: false,
            isPresent: false,
            companyID: 'default-company',
        });

        console.log(`✅ Eklendi: ${user.name} → ${user.email}`);
    }

    console.log('🔥 Tüm kullanıcılar eklendi.');
}

addUsers().catch(console.error);
