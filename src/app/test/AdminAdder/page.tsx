'use client';

import { useEffect, useState } from 'react';
import { db } from '../../lib/firebase';
import { collection, addDoc, query, where, getDocs } from 'firebase/firestore';

export default function AdminAdder() {
  const [done, setDone] = useState(false);

  useEffect(() => {
    const addAdmin = async () => {
      try {
        // admin@ai.com email'li kullanıcı zaten varsa tekrar ekleme
        const q = query(collection(db, 'uyeler'), where('email', '==', 'admin@ai.com'));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
          console.log('admin@ai.com zaten kayıtlı');
          setDone(true);
          return;
        }

        await addDoc(collection(db, 'uyeler'), {
          email: 'admin@ai.com',
          giris_zamani: '2025-05-03 11:37:29',
          isPresent: false,
          ofis: 'Ana Ofis',
          role: 'admin',
        });

        console.log('admin@ai.com başarıyla eklendi');
        setDone(true);
      } catch (err) {
        console.error('Hata oluştu:', err);
      }
    };

    addAdmin();
  }, []);

  return (
    <div className="p-10 text-center">
      {done ? '✅ admin@ai.com eklendi ya da zaten vardı.' : '⏳ admin@ai.com ekleniyor...'}
    </div>
  );
}
