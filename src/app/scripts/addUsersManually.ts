import { initializeApp, cert, ServiceAccount } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import serviceAccount from './serviceAccountKey.json';

initializeApp({
    credential: cert(serviceAccount as ServiceAccount),
});

const db = getFirestore();

// kullanıcı listesi ve uploadUsers fonksiyonu aynı kalabilir

const users = [
    { uid: "qX9sA17KE3abOVBwXArOAhPeKbt2", email: "erenturan685@gmail.com", name: "Eren Turan" },
    { uid: "Zv6RHOUaCQZmskUHFJx1fw2YR8D3", email: "idris.celik7265@gmail.com", name: "İdris Çelik" },
    { uid: "3dQ8nm09TrOQP7pISN8hc4VLk6f2", email: "halil10trkmn@gmail.com", name: "Halil İbrahim Türkmen" },
    { uid: "ZSAIoKum84XQUs55VS3XWM0SXyo1", email: "agirmanberat668@gmail.com", name: "Ahmet Berat Ağırman" },
    { uid: "NK0zfK7q07ce4z8GqpdASHbF9RA2", email: "yusufyilmaz.f@gmail.com", name: "Yusuf Yılmaz" },
    { uid: "VwbqcDEbBFdswxZNUPF73LPnJ0B2", email: "00kerem00arslan@gmail.com", name: "Keremalp Arslan" },
    { uid: "lVUNCsjMiJYn71PNjsZ4ut9FvNY2", email: "muhammedrezancan@gmail.com", name: "Muhammed Rezan Can" },
    { uid: "YqU5V6Dvckc0AuuUUbtAJy256fZ2", email: "ahmetarabaci20005@gmail.com", name: "Ahmet Arabacı" },
    { uid: "G60Lo5mLiBSJTdrHjkC6QYLekqf2", email: "sumeyyedilaradogan@gmail", name: "Sümmeye Dilara Yılmaz" }
];

async function uploadUsers() {
    for (const user of users) {
        await db.collection('users').doc(user.uid).set({
            uid: user.uid,
            email: user.email,
            name: user.name,
            isAdmin: false,
            role: "member",
            isPresent: true,
            companyID: "AI Ofisi"
        });
        console.log(`✅ ${user.name} eklendi`);
    }
}

uploadUsers().then(() => {
    console.log("🎉 Tüm kullanıcılar başarıyla eklendi.");
});
