import {
    doc,
    updateDoc,
    serverTimestamp,
    addDoc,
    collection,
} from 'firebase/firestore';
import { db } from '../../../lib/firebase';

/**
 * Görevi onaylayıp ilgili görev belgesini günceller.
 * @param task Görev objesi (id, companyID, tip, vb. içermeli)
 */
export async function approveTaskAndAssignToUser(task: any) {
    try {
        const { companyID, id, tip = 'temizlik' } = task;

        if (!companyID || !id) {
            console.error('❌ Görev onaylanamadı: Eksik companyID veya id');
            return;
        }

        // Görev tipi (temizlik / yemek) göre path belirle
        const koleksiyonAdi = tip === 'yemek' ? 'yemekGorevListesi' : 'temizlikGorevListesi';

        // Firestore görev belgesini güncelle
        const taskRef = doc(db, `tasks/${companyID}/${koleksiyonAdi}`, id);
        await updateDoc(taskRef, {
            durum: 'onaylandı',
            assignedAt: serverTimestamp(),
        });

        console.log(`✅ Görev "${id}" onaylandı → ${koleksiyonAdi}`);

        // İstersen burada log kaydı da ekleyebilirsin:
        // await addDoc(collection(db, 'gorevGecmisi'), {
        //   atanan: task.atanan,
        //   tarih: task.tarih,
        //   gorev: tip,
        // });

    } catch (err) {
        console.error("❌ Görev onaylama hatası:", err);
    }
}
