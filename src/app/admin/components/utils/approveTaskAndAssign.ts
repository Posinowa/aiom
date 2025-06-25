import {
    doc,
    setDoc,
    getDocs,
    query,
    where,
    collection,
} from 'firebase/firestore';
import { db } from '../../../lib/firebase';


/**
 * Görevi onaylayıp ilgili kullanıcının alt koleksiyonuna yazan fonksiyon.
 * @param task Görev objesi – içinde atanan kişinin adı veya e-posta bilgisi olmalı
 */
export async function approveTaskAndAssignToUser(task: any) {
    try {
        // 1. Email adresi görev objesinde atanmış mı kontrol et
        const userEmail = task.assignedEmail || task.email;
        if (!userEmail) {
            console.error("Görev objesinde 'assignedEmail' veya 'email' alanı eksik.");
            return;
        }

        // 2. UID'yi Firestore'dan email'e göre bul
        const q = query(collection(db, 'uyeler'), where('email', '==', userEmail));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            console.error("Eşleşen kullanıcı bulunamadı:", userEmail);
            return;
        }

        const uid = snapshot.docs[0].id;

        // 3. Kullanıcının alt koleksiyonuna görevi yaz
        await setDoc(doc(db, `users/${uid}/tasks`, task.id), {
            ...task,
            durum: 'onaylandı',              // 🟢 Görev görünmesi için şart
            assignedAt: new Date(),          // 🕓 Zaman damgası
        });

        console.log(`✅ Görev başarıyla atandı: ${userEmail} → ${task.id}`);
    } catch (err) {
        console.error("❌ Görev onaylama hatası:", err);
    }
}
