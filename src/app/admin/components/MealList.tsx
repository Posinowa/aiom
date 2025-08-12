'use client';

import { useEffect, useState } from 'react';
import {
  collection, getDocs, addDoc, updateDoc, deleteDoc,
  query, where, doc, getDoc, Timestamp, setDoc, onSnapshot
} from 'firebase/firestore';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { db } from '../../lib/firebase';
import { approveTaskAndAssignToUser } from '../components/utils/approveTaskAndAssign';

interface MealTask {
  id: string;
  atanan: string;
  tarih: any;
  durum: string;
  yer: string;
  email?: string;
  companyID?: string;
  // ✅ sadece UI için (Firestore'a yazmıyoruz)
  expiresAt?: number;
}

interface MealPlace {
  id: string;
  name: string;
}

export default function MealTasks() {
  const [members, setMembers] = useState<{ id: string; name: string; email: string }[]>([]);
  const [tasks, setTasks] = useState<MealTask[]>([]);
  const [places, setPlaces] = useState<MealPlace[]>([]);
  const [newPlace, setNewPlace] = useState('');
  const [assignCount, setAssignCount] = useState<number>(2);
  const [loading, setLoading] = useState(false);
  const [companyID, setCompanyID] = useState<string | null>(null);
  const [lastAssignedDate, setLastAssignedDate] = useState<string | null>(null);
  const [usedUsernames, setUsedUsernames] = useState<string[]>([]);

  const todayStr = new Date().toDateString();
  const auth = getAuth();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) return;
      const q = query(collection(db, 'users'), where('email', '==', user.email));
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        const userData = snapshot.docs[0].data();
        setCompanyID(userData.companyID);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!companyID) return;

    const fetchMembers = async () => {
      const q = query(collection(db, 'users'), where('companyID', '==', companyID), where('isPresent', '==', true));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as any[];
      setMembers(data.filter((m) => m.name && m.email));
    };

    const fetchPlaces = async () => {
      const q = collection(db, 'tasks', companyID, 'yemekYerleri');
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as MealPlace[];
      setPlaces(data);
    };

    fetchMembers();
    fetchPlaces();
  }, [companyID]);

  // ✅ Onaylı yemek görevlerini dinle ve 5 dk ekranda tut
  useEffect(() => {
    if (!companyID) return;

    const qy = query(
      collection(db, 'tasks', companyID, 'yemekGorevListesi'),
      where('durum', '==', 'onaylandı')
    );

    const unsub = onSnapshot(qy, (snap) => {
      const fiveMin = 5 * 60 * 1000;
      const addList: MealTask[] = [];

      snap.forEach((docu) => {
        const d = docu.data() as any;
        const baseMs = d?.tarih?.seconds ? d.tarih.seconds * 1000 : Date.now();
        const expiresAt = baseMs + fiveMin;

        addList.push({
          id: d.id || '',
          atanan: d.atanan,
          tarih: d.tarih,
          durum: 'onaylandı',
          yer: d.yer || '-',
          email: d.email || '',
          companyID,
          expiresAt,
        });
      });

      setTasks((prev) => {
        const prevKeys = new Set(prev.map(t => `${t.atanan}-${t.tarih?.seconds || ''}`));
        const toAdd = addList
          .filter(t => !prevKeys.has(`${t.atanan}-${t.tarih?.seconds || ''}`))
          .filter(t => !t.expiresAt || t.expiresAt > Date.now());
        return [...prev, ...toAdd];
      });
    });

    return () => unsub();
  }, [companyID]);

  interface Member {
    id: string;
    name: string;
    email: string;
    gender?: string;
    isPresent?: boolean;
  }

  // Sadece bu fonksiyonu değiştir
  const assignMealTasks = async () => {
    if (!companyID) return;

    // Gün değiştiyse günlük havuzu sıfırla
    const todayStr = new Date().toDateString();
    if (lastAssignedDate !== todayStr) {
      setUsedUsernames([]);
      setLastAssignedDate(todayStr);
    }

    // Şu an ekranda ONAYLI olanlar -> bugün tekrar atanmasın
    const approvedNow = new Set(
      tasks
        .filter(t => t.durum === 'onaylandı') // (opsiyonel) && (!(t as any).expiresAt || (t as any).expiresAt > Date.now())
        .map(t => t.atanan)
    );

    // Güncel aktif üyeleri çek
    const qUsers = query(
      collection(db, 'users'),
      where('companyID', '==', companyID),
      where('isPresent', '==', true)
    );
    const snapshot = await getDocs(qUsers);
    const freshMembers = snapshot.docs
      .map(d => ({ id: d.id, ...(d.data() as any) }))
      .filter((m: any) => m?.name && m?.email) as { id: string; name: string; email: string }[];

    // Havuz: bugün seçilmiş + onaylı olanlar hariç
    let pool = freshMembers.filter(
      m => !usedUsernames.includes(m.name) && !approvedNow.has(m.name)
    );

    // Havuz yeterli değilse: sadece onaylı olmayan herkesten seç (günü resetlemeden)
    if (pool.length < assignCount) {
      pool = freshMembers.filter(m => !approvedNow.has(m.name));
    }

    // Seçilecek kişiler
    const finalMembers = [...pool].sort(() => 0.5 - Math.random()).slice(0, assignCount);
    if (finalMembers.length === 0) {
      // istersen uyarı basabilirsin
      // toast.error('Atanacak uygun kişi bulunamadı.');
      return;
    }

    // Kart üretimi (mevcut yapınla aynı)
    const shuffledPlaces = [...places].sort(() => 0.5 - Math.random());
    const now = Timestamp.now();

    const newTasks: MealTask[] = finalMembers.map((user, i) => ({
      id: '',
      atanan: user.name,
      tarih: now,
      durum: 'beklemede',
      yer: shuffledPlaces[i]?.name || '-',
      email: user.email,
      companyID,
    }));

    setTasks(newTasks);
    setUsedUsernames(prev => [...prev, ...finalMembers.map(m => m.name)]);
    setLastAssignedDate(todayStr);
  };


  const approveTask = async (task: MealTask) => {
    if (!companyID) return;

    const docRef = await addDoc(collection(db, 'tasks', companyID, 'yemekGorevListesi'), {
      ...task,
      durum: 'onaylandı',
    });

    const taskRef = doc(db, 'tasks', companyID, 'yemekGorevListesi', docRef.id);

    try {
      await updateDoc(taskRef, { id: docRef.id });
    } catch {
      await setDoc(taskRef, { ...task, id: docRef.id, durum: 'onaylandı' });
    }

    const updated = tasks.map((t) =>
      t.atanan === task.atanan && t.tarih === task.tarih
        ? { ...t, durum: 'onaylandı', id: docRef.id }
        : t
    );
    setTasks(updated);

    await approveTaskAndAssignToUser({
      ...task,
      id: docRef.id,
      companyID,
      tip: 'yemek',
      assignedEmail: task.email,
    });

    const weekStr = new Date().toISOString().slice(0, 10);
    const weeklyRef = doc(db, 'weeklyTasks', companyID, weekStr, 'yemekListesi');
    const snap = await getDoc(weeklyRef);
    const existing = snap.exists() ? snap.data().yemekGorevListesi || [] : [];

    const updatedList = [
      ...existing,
      {
        id: docRef.id,
        atanan: task.atanan,
        tarih: task.tarih,
        durum: 'onaylandı',
        yer: task.yer || '-',
        email: task.email || '',
      },
    ];

    await setDoc(weeklyRef, {
      companyID,
      createdAt: Timestamp.now(),
      yemekGorevListesi: updatedList,
    });
  };

  const addPlace = async () => {
    if (!newPlace.trim() || !companyID) return;
    await addDoc(collection(db, 'tasks', companyID, 'yemekYerleri'), {
      name: newPlace.trim(),
      companyID,
    });
    setNewPlace('');
    const snapshot = await getDocs(collection(db, 'tasks', companyID, 'yemekYerleri'));
    const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as MealPlace[];
    setPlaces(data);
  };

  const clearPlaces = async () => {
    if (!companyID) return;
    const snapshot = await getDocs(collection(db, 'tasks', companyID, 'yemekYerleri'));
    for (const docu of snapshot.docs) {
      await deleteDoc(doc(db, 'tasks', companyID, 'yemekYerleri', docu.id));
    }
    setPlaces([]);
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow mt-10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-2">
        <h3 className="text-xl font-semibold">Meal Tasks</h3>
        <div className="flex gap-2">
          <input
            type="number"
            value={assignCount}
            onChange={(e) => setAssignCount(parseInt(e.target.value) || 2)}
            className="w-12 border rounded text-center"
          />
          <button
            onClick={assignMealTasks}
            disabled={loading}
            className="bg-gray-200 hover:bg-gray-100 text-black text-sm px-4 py-2 rounded"
          >
            {loading ? 'Atanıyor...' : 'Görev Ata'}
          </button>
        </div>
      </div>

      <div className="mb-4 flex flex-col md:flex-row justify-between gap-2">
        <input
          type="text"
          value={newPlace}
          onChange={(e) => setNewPlace(e.target.value)}
          placeholder="örn. yemek dağıtımı"
          className="border px-3 py-1 rounded w-full"
        />
        <div className="flex gap-2">
          <button onClick={addPlace} className="bg-gray-300 hover:bg-gray-200 px-3 py-1 rounded">
            Ekle
          </button>
          <button onClick={clearPlaces} className="bg-red-200 hover:bg-red-300 px-3 py-1 rounded text-red-800">
            Geçmişi Temizle
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {tasks
          .filter((task) => {
            // ✅ Onaylı kartlar (süresi dolmadıysa) her zaman görünsün
            if (task.durum === 'onaylandı') {
              return !task.expiresAt || task.expiresAt > Date.now();
            }
            // Diğerleri günlük filtre
            return lastAssignedDate
              ? new Date(task.tarih?.seconds * 1000).toDateString() === lastAssignedDate
              : false;
          })
          .map((task, index) => (
            <div
              key={index}
              className="bg-white rounded-xl shadow p-5 flex flex-col justify-between border"
            >
              <div>
                <p className="text-sm font-medium">Atanan: {task.atanan}</p>
                <p className="text-xs text-gray-500">Yer: {task.yer || '-'}</p>
                <p className="text-xs text-gray-500">
                  Tarih: {new Date(task.tarih?.seconds * 1000).toLocaleDateString()}
                </p>
              </div>
              <div className="flex items-center justify-between mt-2">
                <span
                  className={`text-xs px-2 py-1 rounded-full font-medium ${task.durum === 'tamamlandı'
                    ? 'bg-green-100 text-green-800'
                    : task.durum === 'onaylandı'
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-gray-100 text-gray-800'
                    }`}
                >
                  {task.durum}
                </span>
                {task.durum === 'beklemede' && (
                  <button
                    onClick={() => approveTask(task)}
                    className="text-xs bg-blue-500 text-white px-3 py-1 rounded"
                  >
                    Onayla
                  </button>
                )}
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}
