'use client';

import { useEffect, useState } from 'react';
import { db } from '../src/app/lib/firebase';
import { collection, addDoc, query, where, getDocs } from 'firebase/firestore';

export default function ErenTuranAdder() {
  const [done, setDone] = useState(false);

  useEffect(() => {
    const addErenTuran = async () => {
      try {
        // Eren Turan zaten varsa tekrar ekleme
        const q = query(collection(db, 'uyeler'), where('name', '==', 'Eren Turan'));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
          console.log('Eren Turan zaten kayıtlı');
          setDone(true);
          return;
        }

        await addDoc(collection(db, 'uyeler'), {
          name: 'Eren Turan',
          giris_zamani: '2025-05-03 11:37:29',
          isPresent: false,
          ofis: 'Ana Ofis',
          role: 'member',
        });

        console.log('Eren Turan başarıyla eklendi');
        setDone(true);
      } catch (err) {
        console.error('Hata oluştu:', err);
      }
    };

    addErenTuran();
  }, []);

  return (
    <div className="p-10 text-center">
      {done ? '✅ Eren Turan eklendi ya da zaten vardı.' : '⏳ Eren Turan ekleniyor...'}
    </div>
  );
}
