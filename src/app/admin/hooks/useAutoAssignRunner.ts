'use client';

import { useState } from 'react';
import { db } from '../../lib/firebase';  // Firestore bağlantınız
import { addDoc, collection, getDocs, query, where } from 'firebase/firestore';

export function useAutoAssignRunner() {
    const [loading, setLoading] = useState(false);

    // Temizlik görevlerini atamak için kullanılan fonksiyon
    const assignTasks = async (companyID: string, assignCount: number) => {
        setLoading(true);

        try {
            // Kullanıcıları Firestore'dan al
            const usersQuery = query(
                collection(db, 'users'),
                where('companyID', '==', companyID),
                where('isPresent', '==', true)  // Yalnızca aktif üyeler
            );
            const usersSnapshot = await getDocs(usersQuery);
            const users = usersSnapshot.docs.map(doc => doc.data());

            // Temizlik yerlerini Firestore'dan al
            const placesSnapshot = await getDocs(collection(db, 'tasks', companyID, 'temizlikYerleri'));
            const places = placesSnapshot.docs.map(doc => doc.data());

            // Kullanıcıları ve yerleri rastgele karıştır
            let availableUsers = [...users].sort(() => Math.random() - 0.5);
            let availablePlaces = [...places].sort(() => Math.random() - 0.5);

            // Atanacak kullanıcı sayısını kullanıcı sayısına göre sınırla
            const usersToAssign = availableUsers.slice(0, Math.min(assignCount, availableUsers.length));
            const tasks = usersToAssign.map((user, index) => ({
                atanan: user.name,
                yer: availablePlaces[index % availablePlaces.length]?.name || 'Belirtilmedi',
                tarih: new Date(), // Şu anki tarih
                durum: 'beklemede',
            }));

            // Firestore'a görevleri kaydet
            for (const task of tasks) {
                // her görev için Firestore'a ekleme yapılır
                await addDoc(collection(db, 'tasks', companyID, 'temizlikGorevListesi'), task);
            }

            console.log('Görevler başarıyla atandı:', tasks);
        } catch (error) {
            console.error('Görev atama işlemi sırasında hata oluştu:', error);
        } finally {
            setLoading(false);
        }
    };

    return { assignTasks, loading };
}
