// CleaningTasks.tsx

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

interface CleaningTask {
  id: string;
  atanan: string;
  tarih: any;
  durum: string;
  yer: string;
  email?: string;
}

interface CleaningPlace {
  id: string;
  name: string;
}

export default function CleaningTasks() {
  const [members, setMembers] = useState<{ id: string; name: string; email: string }[]>([]);
  const [tasks, setTasks] = useState<CleaningTask[]>([]);
  const [places, setPlaces] = useState<CleaningPlace[]>([]);
  const [newPlace, setNewPlace] = useState('');
  const [assignCount, setAssignCount] = useState<number>(2);
  const [loading, setLoading] = useState(false);
  const [allowDuplicateToday, setAllowDuplicateToday] = useState(false);
  const [companyID, setCompanyID] = useState<string | null>(null);
  const [lastAssignedDate, setLastAssignedDate] = useState<string | null>(null);
  const [usedUsernames, setUsedUsernames] = useState<string[]>([]);
  const [pendingTasks, setPendingTasks] = useState<CleaningTask[]>([]);

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
      const q = query(collection(db, 'temizlikYerleri'), where('companyID', '==', companyID));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as CleaningPlace[];
      setPlaces(data);
    };

    fetchMembers();
    fetchPlaces();
  }, [companyID]);

  const assignCleaningTasks = () => {
    if (!companyID) return;

    const availableMembers = members.filter((m) => !usedUsernames.includes(m.name));
    let finalMembers;

    if (availableMembers.length < assignCount) {
      setUsedUsernames([]);
      finalMembers = [...members].sort(() => 0.5 - Math.random()).slice(0, assignCount);
    } else {
      finalMembers = [...availableMembers].sort(() => 0.5 - Math.random()).slice(0, assignCount);
    }

    const shuffledPlaces = [...places].sort(() => 0.5 - Math.random());
    const now = Timestamp.now();
    const nowStr = new Date().toDateString();

    const newTasks: CleaningTask[] = finalMembers.map((user, i) => ({
      id: '',
      atanan: user.name,
      tarih: now,
      durum: 'beklemede',
      yer: shuffledPlaces[i]?.name || '-',
      email: user.email,
      companyID,
    }));

    setPendingTasks(newTasks);
    setTasks(newTasks);
    setUsedUsernames((prev) => [...prev, ...finalMembers.map((m) => m.name)]);
    setLastAssignedDate(nowStr);
  };

  const approveTask = async (task: CleaningTask) => {
    const docRef = await addDoc(collection(db, `tasks/${companyID}/temizlikGorevListesi`), {
      ...task,
      durum: 'onaylandı',
    });

    await updateDoc(doc(db, `tasks/${companyID}/temizlikGorevListesi`, docRef.id), {
      id: docRef.id,
    });

    const updated = tasks.map((t) =>
      t.atanan === task.atanan && t.tarih === task.tarih
        ? { ...t, durum: 'onaylandı', id: docRef.id }
        : t
    );

    setTasks(updated);

    await approveTaskAndAssignToUser({
      ...task,
      id: docRef.id,
      assignedEmail: task.email,
    });
  };

  const addPlace = async () => {
    if (!newPlace.trim() || !companyID) return;
    await addDoc(collection(db, 'temizlikYerleri'), { name: newPlace.trim(), companyID });
    setNewPlace('');
    const snapshot = await getDocs(query(collection(db, 'temizlikYerleri'), where('companyID', '==', companyID)));
    const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as CleaningPlace[];
    setPlaces(data);
  };

  const clearPlaces = async () => {
    if (!companyID) return;
    const snapshot = await getDocs(query(collection(db, 'temizlikYerleri'), where('companyID', '==', companyID)));
    for (const docu of snapshot.docs) {
      await deleteDoc(doc(db, 'temizlikYerleri', docu.id));
    }
    setPlaces([]);
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow mt-10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-2">
        <h3 className="text-xl font-semibold">Cleaning Tasks</h3>
        <div className="flex gap-2">
          <input
            type="number"
            value={assignCount}
            onChange={(e) => setAssignCount(parseInt(e.target.value) || 2)}
            className="w-12 border rounded text-center"
          />
          <button
            onClick={assignCleaningTasks}
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
          placeholder="örn. salon temizliği"
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
