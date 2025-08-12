'use client';

import { useEffect, useRef, useState } from 'react';
import {
  collection, getDocs, addDoc, updateDoc, deleteDoc,
  query, where, doc, getDoc, Timestamp, setDoc, onSnapshot
} from 'firebase/firestore';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { db } from '../../lib/firebase';
import { approveTaskAndAssignToUser } from '../components/utils/approveTaskAndAssign';
import toast, { Toaster } from 'react-hot-toast';

interface CleaningTask {
  id: string;
  atanan: string;
  tarih: any;
  durum: string;          // 'beklemede' | 'onaylandı' | 'tamamlandı'
  yer: string;
  email?: string;
  // ▼ sadece UI amaçlı (Firestore’a yazmıyoruz)
  expiresAt?: number;     // ms
}

interface CleaningPlace {
  id: string;
  name: string;
}

/* ---------- HAFTALIK İSTATİSTİK (mevcutlardan) ---------- */
const getWeekStartISO = () => {
  const d = new Date();
  const day = d.getDay() || 7; // Paz=7, Pzt=1
  if (day !== 1) d.setDate(d.getDate() - (day - 1));
  return d.toISOString().slice(0, 10);
};

async function getWeekStats(companyID: string) {
  const weeklyRef = doc(db, 'weeklyTasks', companyID, getWeekStartISO(), 'temizlikListesi');
  const snap = await getDoc(weeklyRef);
  const listKey = 'temizlikGorevListesi';
  const items: any[] = snap.exists() ? (snap.data()?.[listKey] || []) : [];

  const count = new Map<string, number>();
  const lastAt = new Map<string, number>();
  const y = new Date(); y.setDate(y.getDate() - 1);
  const yStr = y.toDateString();
  const assignedYesterday = new Set<string>();

  for (const it of items) {
    const name = it?.atanan;
    if (!name) continue;
    count.set(name, (count.get(name) || 0) + 1);
    const ms = it?.tarih?.seconds ? it.tarih.seconds * 1000 : it?.tarih?.toMillis?.() || 0;
    if (ms) {
      if ((lastAt.get(name) || 0) < ms) lastAt.set(name, ms);
      if (new Date(ms).toDateString() === yStr) assignedYesterday.add(name);
    }
  }
  return { count, lastAt, assignedYesterday };
}

/* ---------- UI kalıcılık yardımcıları ---------- */
const storageKey = (companyID: string) => `cleaning:visible:${companyID}`;

function readPersisted(companyID: string): CleaningTask[] {
  try {
    const raw = localStorage.getItem(storageKey(companyID));
    if (!raw) return [];
    const arr = JSON.parse(raw) as CleaningTask[];
    const now = Date.now();
    return arr.filter(t => !t.expiresAt || t.expiresAt > now);
  } catch { return []; }
}

function writePersisted(companyID: string, tasks: CleaningTask[]) {
  try {
    localStorage.setItem(storageKey(companyID), JSON.stringify(tasks));
  } catch { }
}

function upsertPersisted(companyID: string, task: CleaningTask) {
  const list = readPersisted(companyID);
  const key = `${task.atanan}-${task.tarih?.seconds || ''}`;
  const merged = [
    ...list.filter(t => `${t.atanan}-${t.tarih?.seconds || ''}` !== key),
    task,
  ];
  writePersisted(companyID, merged);
}

/* ======================================================== */

export default function CleaningTasks() {
  const [members, setMembers] = useState<{ id: string; name: string; email: string }[]>([]);
  const [tasks, setTasks] = useState<CleaningTask[]>([]);
  const [places, setPlaces] = useState<CleaningPlace[]>([]);
  const [newPlace, setNewPlace] = useState('');
  const [assignCount, setAssignCount] = useState<number>(2);
  const [loading, setLoading] = useState(false);
  const [companyID, setCompanyID] = useState<string | null>(null);
  const [lastAssignedDate, setLastAssignedDate] = useState<string | null>(null);
  const [usedUsernames, setUsedUsernames] = useState<string[]>([]);
  const [approvingKey, setApprovingKey] = useState<string | null>(null);

  // Bildirimlerde çift gösterimi engellemek için
  const shownNotifsRef = useRef<Set<string>>(new Set());

  /* ----- Auth -> companyID ----- */
  useEffect(() => {
    const unsub = onAuthStateChanged(getAuth(), async (user) => {
      if (!user) return;
      const qy = query(collection(db, 'users'), where('email', '==', user.email));
      const snap = await getDocs(qy);
      if (!snap.empty) {
        const userData = snap.docs[0].data() as any;
        setCompanyID(userData.companyID);
      }
    });
    return () => unsub();
  }, []);

  // ✅ Onaylı görevleri Firestore'dan çek ve 5 dk boyunca ekranda tut
  useEffect(() => {
    if (!companyID) return;

    const qy = query(
      collection(db, 'tasks', companyID, 'temizlikGorevListesi'),
      where('durum', '==', 'onaylandı')
    );

    const unsub = onSnapshot(qy, (snap) => {
      const fiveMin = 5 * 60 * 1000;
      const now = Date.now();

      const fromFs: CleaningTask[] = [];
      snap.forEach((docu) => {
        const data = docu.data() as any;

        // Firestore'daki tarihe göre bitişi hesapla (tarih + 5dk)
        const baseMs = data?.tarih?.seconds
          ? data.tarih.seconds * 1000
          : now;

        const expiresAt = baseMs + fiveMin;

        fromFs.push({
          id: data.id || '',
          atanan: data.atanan,
          tarih: data.tarih,
          durum: 'onaylandı',
          yer: data.yer || '-',
          email: data.email || '',
          expiresAt, // UI süre sonu
        });
      });

      // Mevcut listeye ekle (varsa tekrar ekleme) ve süresi dolmuşları alma
      setTasks((prev) => {
        const prevKeys = new Set(prev.map(t => `${t.atanan}-${t.tarih?.seconds || ''}`));
        const add = fromFs
          .filter(t => !prevKeys.has(`${t.atanan}-${t.tarih?.seconds || ''}`))
          .filter(t => !t.expiresAt || t.expiresAt > Date.now());

        // localStorage kalıcılığı da güncel kalsın (isteğe bağlı)
        if (companyID && add.length) {
          const current = readPersisted(companyID);
          writePersisted(companyID, [
            ...current,
            ...add,
          ]);
        }

        return [...prev, ...add];
      });
    });

    return () => unsub();
  }, [companyID]);

  /* ----- Görev tamamlandı bildirimi ----- */
  useEffect(() => {
    if (!companyID) return;
    const qy = query(collection(db, 'gorevGecmisi'), where('companyID', '==', companyID));
    const unsub = onSnapshot(qy, (snapshot) => {
      snapshot.docChanges().forEach((ch) => {
        const data = ch.doc.data() as any;
        const id = ch.doc.id;
        if (ch.type === 'added' && !shownNotifsRef.current.has(id)) {
          shownNotifsRef.current.add(id);
          if (data?.atanan && data?.gorev) {
            toast.success(`✅ ${data.atanan} ${data.gorev} görevini başarıyla tamamladı!`);
          }
        }
      });
    });
    return () => unsub();
  }, [companyID]);

  /* ----- Durum dinleyici (tamamlandı/onarlandı) ----- */
  useEffect(() => {
    if (!companyID) return;
    const colRef = collection(db, 'tasks', companyID, 'temizlikGorevListesi');
    const unsub = onSnapshot(colRef, (snap) => {
      snap.docChanges().forEach((change) => {
        const data: any = change.doc.data();
        if (!data?.atanan || !data?.tarih?.seconds) return;
        setTasks((prev) =>
          prev.map((t) =>
            t.atanan === data.atanan && t.tarih?.seconds === data.tarih?.seconds
              ? { ...t, durum: data.durum || t.durum }
              : t
          )
        );
      });
    });
    return () => unsub();
  }, [companyID]);

  const assignCleaningTasks = async () => {
    if (!companyID) return;

    const todayStr = new Date().toDateString();
    if (lastAssignedDate !== todayStr) {
      setUsedUsernames([]);
      setLastAssignedDate(todayStr);
    }

    // Şu an ekranda ONAYLI olanlar (süresi dolmadıysa) -> havuzdan çıkar
    const approvedNow = new Set(
      tasks
        .filter(t => t.durum === 'onaylandı' && (!t.expiresAt || t.expiresAt > Date.now()))
        .map(t => t.atanan)
    );

    // Aktif üyeleri çek
    const qUsers = query(
      collection(db, 'users'),
      where('companyID', '==', companyID),
      where('isPresent', '==', true)
    );
    const s1 = await getDocs(qUsers);
    const freshMembers = s1.docs
      .map(d => ({ id: d.id, ...(d.data() as any) }))
      .filter((m: any) => m?.name && m?.email) as { id: string; name: string; email: string }[];

    // Havuz: bugün seçilmişler + onaylı (görünür) olanlar hariç
    let pool = freshMembers.filter(
      m => !usedUsernames.includes(m.name) && !approvedNow.has(m.name)
    );

    // Adil sıralama için (varsa) haftalık istatistikleri al
    let ordered: { id: string; name: string; email: string }[] = [];
    try {
      const { count, lastAt, assignedYesterday } = await getWeekStats(companyID);
      const sortFn = (a: any, b: any) => {
        const ca = count.get(a.name) || 0;
        const cb = count.get(b.name) || 0;
        if (ca !== cb) return ca - cb;
        const aNotY = assignedYesterday.has(a.name) ? 0 : 1;
        const bNotY = assignedYesterday.has(b.name) ? 0 : 1;
        if (aNotY !== bNotY) return bNotY - aNotY;
        const la = lastAt.get(a.name) || 0;
        const lb = lastAt.get(b.name) || 0;
        return la - lb;
      };
      ordered = [...pool].sort(sortFn);

      // Havuz boşsa: bugün seçilmişleri sıfırla ve onaylı olmayan herkesten seç
      if (ordered.length === 0) {
        // yalnızca approvedNow dışında kalanlardan
        pool = freshMembers.filter(m => !approvedNow.has(m.name));
        ordered = [...pool].sort(sortFn);
      }
    } catch {
      // getWeekStats yoksa veya hata alırsa en azından random sırala
      ordered = [...pool].sort(() => 0.5 - Math.random());
      if (ordered.length === 0) {
        const fallback = freshMembers.filter(m => !approvedNow.has(m.name));
        ordered = [...fallback].sort(() => 0.5 - Math.random());
      }
    }

    // Seçilecek son liste
    const finalMembers = ordered.slice(0, assignCount);
    if (finalMembers.length === 0) {
      // İstersen toast göster:
      // toast.error('Atanacak uygun kişi bulunamadı.');
      return;
    }

    // Kart üret ve state'e yaz
    const shuffledPlaces = [...places].sort(() => 0.5 - Math.random());
    const now = Timestamp.now();

    const newTasks: CleaningTask[] = finalMembers.map((user, i) => ({
      id: '',
      atanan: user.name,
      tarih: now,
      durum: 'beklemede',
      yer: shuffledPlaces[i]?.name || '-',
      email: user.email,
      // companyID gibi ekstra alan yazmıyorsan ekleme
    }));

    setTasks(newTasks);
    setUsedUsernames(prev => [...prev, ...finalMembers.map(m => m.name)]);
    setLastAssignedDate(todayStr);
  };


  /* ----- Onayla: kart 5 dk kalsın ----- */
  const approveTask = async (task: CleaningTask) => {
    if (!companyID) return;

    const key = `${task.atanan}-${task.tarih?.seconds || ''}`;
    setApprovingKey(key);

    // 1) UI'yi hemen güncelle + 5 dk sonra düşecek şekilde persist et
    const fiveMin = 5 * 60 * 1000;
    const withExpiry: CleaningTask = { ...task, durum: 'onaylandı', expiresAt: Date.now() + fiveMin };

    setTasks(prev =>
      prev.map(t =>
        (t.atanan === task.atanan && t.tarih?.seconds === task.tarih?.seconds)
          ? withExpiry
          : t
      )
    );
    upsertPersisted(companyID, withExpiry);

    try {
      // 2) Firestore yazımları (mevcut akışın aynısı)
      const docRef = await addDoc(collection(db, 'tasks', companyID, 'temizlikGorevListesi'), {
        ...task,
        durum: 'onaylandı',
      });

      const taskRef = doc(db, 'tasks', companyID, 'temizlikGorevListesi', docRef.id);
      const snap = await getDoc(taskRef);
      if (snap.exists()) {
        await updateDoc(taskRef, { id: docRef.id });
      } else {
        await setDoc(taskRef, { ...task, id: docRef.id, durum: 'onaylandı' });
      }

      await approveTaskAndAssignToUser({
        id: docRef.id,
        companyID,
        tip: 'temizlik',
        atanan: task.atanan,
        yer: task.yer,
        tarih: task.tarih,
        assignedEmail: task.email,
      });

      const weekStr = new Date().toISOString().slice(0, 10);
      const weeklyRef = doc(db, 'weeklyTasks', companyID, weekStr, 'temizlikListesi');
      const weeklySnap = await getDoc(weeklyRef);
      const existing = weeklySnap.exists() ? weeklySnap.data().temizlikGorevListesi || [] : [];

      await setDoc(weeklyRef, {
        companyID,
        createdAt: Timestamp.now(),
        temizlikGorevListesi: [
          ...existing,
          {
            id: docRef.id,
            atanan: task.atanan,
            tarih: task.tarih,
            durum: 'onaylandı',
            yer: task.yer || '-',
            email: task.email || '',
          },
        ],
      });
    } catch (e) {
      // bir hata olursa kartı geri al
      setTasks(prev =>
        prev.map(t =>
          (t.atanan === task.atanan && t.tarih?.seconds === task.tarih?.seconds)
            ? { ...t, durum: 'beklemede', expiresAt: undefined }
            : t
        )
      );
      // persisted listeden de çıkar
      const list = readPersisted(companyID);
      writePersisted(
        companyID,
        list.filter(t => `${t.atanan}-${t.tarih?.seconds || ''}` !== key)
      );
      console.error(e);
    } finally {
      setApprovingKey(null);
    }
  };

  /* ----- Yerler ----- */
  const addPlace = async () => {
    if (!newPlace.trim() || !companyID) return;
    await addDoc(collection(db, 'tasks', companyID, 'temizlikYerleri'), { name: newPlace.trim() });
    setNewPlace('');
    const snapshot = await getDocs(collection(db, 'tasks', companyID, 'temizlikYerleri'));
    const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as CleaningPlace[];
    setPlaces(data);
  };

  const clearPlaces = async () => {
    if (!companyID) return;
    const snapshot = await getDocs(collection(db, 'tasks', companyID, 'temizlikYerleri'));
    for (const docu of snapshot.docs) {
      await deleteDoc(doc(db, 'tasks', companyID, 'temizlikYerleri', docu.id));
    }
    setPlaces([]);
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow mt-10">
      <Toaster position="top-right" />
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

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {tasks
          .filter((task) => {
            // Onaylandı ise (ve süresi dolmadıysa) her zaman göster
            if (task.durum === 'onaylandı') {
              return !task.expiresAt || task.expiresAt > Date.now();
            }
            // Beklemede ise günlük filtre uygulansın
            return lastAssignedDate
              ? new Date(task.tarih?.seconds * 1000).toDateString() === lastAssignedDate
              : true;
          })

          .map((task, index) => (
            <div key={index} className="bg-white rounded-xl shadow p-5 flex flex-col justify-between border">
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
                    disabled={approvingKey === `${task.atanan}-${task.tarih?.seconds || ''}`}
                    className="text-xs bg-blue-500 text-white px-3 py-1 rounded disabled:opacity-60 disabled:cursor-not-allowed"
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
