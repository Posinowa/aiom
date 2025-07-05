import { initializeApp, cert, ServiceAccount } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
const serviceAccount = require('./serviceAccountKey.json');

initializeApp({
    credential: cert(serviceAccount as ServiceAccount),
});

const db = getFirestore();

type UserData = {
    uid: string;
    name: string;
    email: string;
    role: 'member';
    isAdmin: boolean;
    isPresent: boolean;
    companyID: string;
};

const users: UserData[] = [
    {
        uid: '6nHHtVMlBIMLbScG8nsl',
        name: 'Eren Turan',
        email: 'erenturan685@gmail.com',
        role: 'member',
        isAdmin: false,
        isPresent: false,
        companyID: 'default-company',
    },
    {
        uid: 'aZjXESTQNFC1SXyTmeiB',
        name: 'Keremalp Arslan',
        email: 'keremalparslan@gmail.com',
        role: 'member',
        isAdmin: false,
        isPresent: false,
        companyID: 'default-company',
    },
    {
        uid: 'eIujsFMLKCujhlu5vKOi',
        name: 'Feyza Şahin',
        email: 'feyzanur788@gmail.com',
        role: 'member',
        isAdmin: false,
        isPresent: false,
        companyID: 'default-company',
    },
    {
        uid: 'fBO7pBwfDaVfcYWBQOO',
        name: 'Ahmet Berat Ağırman',
        email: 'agirmanberat668@gmail.com',
        role: 'member',
        isAdmin: false,
        isPresent: false,
        companyID: 'default-company',
    },
    {
        uid: 'h0dye1SXB9elNNuii2kn',
        name: 'Dilara Yılmaz',
        email: 'sumeyyedilaradogan@gmail.com',
        role: 'member',
        isAdmin: false,
        isPresent: false,
        companyID: 'default-company',
    },
    {
        uid: 'k4zHaae0SuaiUTfEFMF2',
        name: 'Ahmet Arabacı',
        email: 'ahmetarabaci20005@gmail.com',
        role: 'member',
        isAdmin: false,
        isPresent: false,
        companyID: 'default-company',
    },
    {
        uid: 'OgmWQFijZSVOG11tdBxB',
        name: 'İdris Çelik',
        email: 'idris.celik7265@gmail.com',
        role: 'member',
        isAdmin: false,
        isPresent: false,
        companyID: 'default-company',
    },
    {
        uid: '5IFyIhHwl1LFjPtnIWAu',
        name: 'Halil İbrahim Türkmen',
        email: 'halil10trkmn@gmail.com',
        role: 'member',
        isAdmin: false,
        isPresent: false,
        companyID: 'default-company',
    },
    {
        uid: 'lFDjeEXy2eMO9OGewpwC',
        name: 'Yusuf Yılmaz',
        email: 'yusufyilmaz.f@gmail.com',
        role: 'member',
        isAdmin: false,
        isPresent: false,
        companyID: 'default-company',
    },
    {
        uid: 'S1McVxsmgZyuVY4lKm2e',
        name: 'Abdüssamed Fenerli',
        email: 'samedfenerli0650@gmail.com',
        role: 'member',
        isAdmin: false,
        isPresent: false,
        companyID: 'default-company',
    },
    {
        uid: 'yxvZbPONuUYEfBKKHiou',
        name: 'Muhammed Rezan Can',
        email: 'muhammedrezancan@gmail.com',
        role: 'member',
        isAdmin: false,
        isPresent: false,
        companyID: 'default-company',
    },
];

async function createUsers() {
    for (const user of users) {
        await db.collection('users').doc(user.uid).set(user);
        console.log(`✅ Eklendi: ${user.name}`);
    }

    console.log('🔥 Tüm kullanıcılar UID’leriyle eklendi.');
}

createUsers().catch(console.error);

export { };
