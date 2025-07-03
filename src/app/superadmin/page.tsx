'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { db } from '../lib/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';

export default function SuperAdminPage() {
  const router = useRouter();

  useEffect(() => {
    const auth = getAuth();
    onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push('/');
        return;
      }

      const q = query(collection(db, 'users'), where('email', '==', user.email));
      const snapshot = await getDocs(q);
      const role = snapshot.docs[0]?.data().role;

      if (role !== 'superAdmin') {
        router.push('/');
      }
    });
  }, []);

  return (
    <div className="p-10">
      <h1 className="text-2xl font-bold mb-4">🚀 Süper Admin Paneli</h1>
      <p>Burada tüm şirketleri görebilir, yeni şirketler oluşturabilirsin.</p>

      {/* Buraya şirket listesi ve şirket ekleme bileşeni gelecek */}
    </div>
  );
}
