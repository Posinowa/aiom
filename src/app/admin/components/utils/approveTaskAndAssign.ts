import {
    doc,
    setDoc,
    getDocs,
    query,
    where,
    collection,
    serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../../lib/firebase';

/**
 * Görevi onaylayıp ilgili kullanıcının alt koleksiyonuna yazan fonksiyon.
 * @param task Görev objesi – içinde atanan kişinin adı veya e-posta bilgisi olmalı
 */
export async function approveTaskAndAssignToUser(task: any) {
    try {
        const userEmail = task.assignedEmail || task.email;
        if (!userEmail) {
            console.error("Görev objesinde 'assignedEmail' veya 'email' alanı eksik.");
            return;
        }

        const q = query(collection(db, 'uyeler'), where('email', '==', userEmail));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            console.error("Eşleşen kullanıcı bulunamadı:", userEmail);
            return;
        }

        const uid = snapshot.docs[0].id;

        await setDoc(doc(db, `users/${uid}/tasks`, task.id), {
            ...task,
            durum: 'onaylandı',
            assignedAt: serverTimestamp(),
        });

        console.log(`✅ Görev başarıyla atandı: ${userEmail} → ${task.id}`);
    } catch (err) {
        console.error("❌ Görev onaylama hatası:", err);
    }
}
