// mealist.tsx

'use client';

import { useEffect, useState } from 'react';
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  doc,
  Timestamp,
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
  const [allowDuplicateToday, setAllowDuplicateToday] = useState(false);
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
      const excludedEmails = ['admin@ai.com'];

      setMembers(
        data
          .filter((m) => !excludedEmails.includes(m.email) && !!m.name)
          .map((m) => ({ id: m.id, name: m.name, email: m.email }))
      );
    };

    const fetchPlaces = async () => {
      const q = query(collection(db, 'yemekYerleri'), where('companyID', '==', companyID));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as MealPlace[];
      setPlaces(data);
    };

    const fetchTasks = async () => {
      const q = collection(db, `tasks/${companyID}/yemekGorevListesi`);
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as MealTask[];
      setTasks(data);
    };

    fetchMembers();
    fetchPlaces();
    fetchTasks();
  }, [companyID]);

  const assignMealTasks = async () => {
    if (!companyID) return;
    setLoading(true);

    const snapshot = await getDocs(collection(db, `tasks/${companyID}/yemekGorevListesi`));
    const allTasks = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as MealTask[];

    const availableMembers = members.filter((m) => !usedUsernames.includes(m.name));

    let finalMembers: typeof members;
    if (availableMembers.length < assignCount) {
      setUsedUsernames([]);
      finalMembers = [...members].sort(() => 0.5 - Math.random()).slice(0, assignCount);
    } else {
      finalMembers = [...availableMembers].sort(() => 0.5 - Math.random()).slice(0, assignCount);
    }

    const shuffledPlaces = [...places].sort(() => 0.5 - Math.random());
    const now = Timestamp.now();
    const nowStr = new Date().toDateString();
    const newTasks: MealTask[] = [];

    for (let i = 0; i < finalMembers.length; i++) {
      const user = finalMembers[i];

      const task = {
        id: '',
        atanan: user.name,
        tarih: now,
        durum: 'beklemede',
        yer: shuffledPlaces[i]?.name || '-',
        email: user.email,
        companyID,
      };

      try {
        const docRef = await addDoc(collection(db, `tasks/${companyID}/yemekGorevListesi`), task);
        await updateDoc(doc(db, `tasks/${companyID}/yemekGorevListesi`, docRef.id), {
          id: docRef.id,
        });
        newTasks.push({ ...task, id: docRef.id });
      } catch (error) {
        console.error('Görev eklenemedi:', error);
      }
    }

    setUsedUsernames((prev) => [...prev, ...finalMembers.map((m) => m.name)]);
    setTasks(newTasks);
    setLastAssignedDate(nowStr);
    setLoading(false);
  };

  const addPlace = async () => {
    if (!newPlace.trim() || !companyID) return;
    await addDoc(collection(db, 'yemekYerleri'), { name: newPlace.trim(), companyID });
    setNewPlace('');
    const snapshot = await getDocs(query(collection(db, 'yemekYerleri'), where('companyID', '==', companyID)));
    const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as MealPlace[];
    setPlaces(data);
  };

  const clearPlaces = async () => {
    if (!companyID) return;
    const snapshot = await getDocs(query(collection(db, 'yemekYerleri'), where('companyID', '==', companyID)));
    for (const docu of snapshot.docs) {
      await deleteDoc(doc(db, 'yemekYerleri', docu.id));
    }
    setPlaces([]);
  };

  const approveTask = async (task: MealTask) => {
    await updateDoc(doc(db, `tasks/${companyID}/yemekGorevListesi/${task.id}`), { durum: 'onaylandı' });
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, durum: 'onaylandı' } : t)));
    await approveTaskAndAssignToUser({
      ...task,
      assignedEmail: task.email,
      id: task.id,
    });
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
          placeholder="örn. çorba hazırlığı"
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

      <label className="flex items-center gap-2 text-sm mb-4">
        <input
          type="checkbox"
          checked={allowDuplicateToday}
          onChange={() => setAllowDuplicateToday(!allowDuplicateToday)}
        />
        Aynı kişiye birden fazla görev atanmasına izin ver
      </label>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {tasks
          .filter((task) =>
            lastAssignedDate
              ? new Date(task.tarih?.seconds * 1000).toDateString() === lastAssignedDate
              : false
          )
          .map((task) => (
            <div
              key={task.id}
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
