'use client';

import { useEffect, useRef, useState } from 'react';
import {
  collection, getDocs, addDoc, updateDoc, deleteDoc,
  query, where, doc, getDoc, Timestamp, setDoc, onSnapshot
} from 'firebase/firestore';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { db } from '../../lib/firebase';
import toast, { Toaster } from 'react-hot-toast';
import AutoAssignPanel from './AutoAssignPanel';

/* ================== Tipler ================== */
interface CleaningTask {
  id: string;
  atanan: string;
  tarih: any;
  durum: string;          // 'beklemede' | 'onaylandı' | 'tamamlandı'
  yer: string;
  email?: string;
  notified?: boolean;     // server mail attıysa true
  // sadece UI amaçlı (Firestore’a yazmıyoruz)
  expiresAt?: number;     // ms
}

interface CleaningPlace {
  id: string;
  name: string;
}

/* ---------- HAFTALIK İSTATİSTİK ---------- */
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

/* ---------- UI kalıcılık (onaylı kart görünürlüğü) ---------- */
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
  try { localStorage.setItem(storageKey(companyID), JSON.stringify(tasks)); } catch { }
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
function removePersisted(companyID: string, task: CleaningTask) {
  const list = readPersisted(companyID);
  const key = `${task.atanan}-${task.tarih?.seconds || ''}`;
  writePersisted(companyID, list.filter(t => `${t.atanan}-${t.tarih?.seconds || ''}` !== key));
}

/* ---------- Günlük usedUsernames persist ---------- */
const usedKey = (companyID: string, dayStr: string) =>
  `cleaning:used:${companyID}:${dayStr}`;

function readUsed(companyID: string, dayStr: string): string[] {
  try {
    const raw = localStorage.getItem(usedKey(companyID, dayStr));
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch { return []; }
}
function writeUsed(companyID: string, dayStr: string, names: string[]) {
  try { localStorage.setItem(usedKey(companyID, dayStr), JSON.stringify(names)); } catch { }
}

/* ---------- küçük yardımcı ---------- */
const keyOf = (t: CleaningTask) => `${t.atanan}-${t.tarih?.seconds || ''}`;
function mergeUnique(prev: CleaningTask[], incoming: CleaningTask[]) {
  const seen = new Set(prev.map(keyOf));
  const add = incoming.filter(t => !seen.has(keyOf(t)));
  return [...prev, ...add];
}

/* ---------- Görünüm yardımcıları ---------- */
const statusStyles = (durum: string) => {
  switch (durum) {
    case 'tamamlandı':
      return { bar: 'bg-emerald-500', chip: 'bg-emerald-100 text-emerald-800' };
    case 'onaylandı':
      return { bar: 'bg-blue-500', chip: 'bg-blue-100 text-blue-800' };
    default:
      return { bar: 'bg-slate-400', chip: 'bg-slate-100 text-slate-800' };
  }
};

const initials = (name?: string) =>
  (name || '-')
    .split(' ')
    .map(s => s[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

/* ================== Bileşen ================== */
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

  const shownNotifsRef = useRef<Set<string>>(new Set());

  /* --------- E-posta gönderim helper (TOAST YOK) --------- */
  const sendAssignmentEmail = async (payload: {
    to: string; atanan: string; yer?: string; tarihMs?: number;
    taskId: string; companyID: string; listId?: 'temizlikGorevListesi' | 'yemekGorevListesi';
  }) => {
    try {
      const res = await fetch('/api/send-assignment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      // başarılı/başarısız—UI’da hiçbir şey gösterme:
      // const _json = await res.json().catch(() => ({}));
    } catch (e) {
      // debug istersen açarsın:
      // console.error('mail error', e);
    }
  };

  /* Auth -> companyID */
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

  /* Onaylı görevleri çek (5 dk görünür) */
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
        const baseMs = data?.tarih?.seconds ? data.tarih.seconds * 1000 : now;
        const expiresAt = baseMs + fiveMin;
        fromFs.push({
          id: data.id || '',
          atanan: data.atanan,
          tarih: data.tarih,
          durum: 'onaylandı',
          yer: data.yer || '-',
          email: data.email || '',
          notified: !!data.notified,
          expiresAt,
        });
      });
      setTasks((prev) => {
        const prevKeys = new Set(prev.map(t => `${t.atanan}-${t.tarih?.seconds || ''}`));
        const add = fromFs
          .filter(t => !prevKeys.has(`${t.atanan}-${t.tarih?.seconds || ''}`))
          .filter(t => !t.expiresAt || t.expiresAt > Date.now());
        if (companyID && add.length) {
          const current = readPersisted(companyID);
          writePersisted(companyID, [...current, ...add]);
        }
        return [...prev, ...add];
      });
    });
    return () => unsub();
  }, [companyID]);

  /* Görev tamamlandı bildirimi (toast kalsın) */
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

  /* Durum dinleyici */
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
              ? { ...t, durum: data.durum || t.durum, notified: !!data.notified }
              : t
          )
        );
      });
    });
    return () => unsub();
  }, [companyID]);

  /* BUGÜN used list */
  useEffect(() => {
    if (!companyID) return;
    const today = new Date().toDateString();
    const saved = readUsed(companyID, today);
    if (saved.length) {
      setUsedUsernames(saved);
      setLastAssignedDate(today);
    }
  }, [companyID]);

  /* Görev ata (beklemede oluştur + liste döndür) */
  const assignCleaningTasks = async () => {
    if (!companyID) return;

    const todayStr = new Date().toDateString();
    if (lastAssignedDate !== todayStr) {
      setUsedUsernames([]);
      setLastAssignedDate(todayStr);
    }

    // ekranda onaylı olanlar -> havuzdan çıkar
    const approvedNow = new Set(
      tasks
        .filter(t => t.durum === 'onaylandı' && (!t.expiresAt || t.expiresAt > Date.now()))
        .map(t => t.atanan)
    );

    // aktif üyeler
    const qUsers = query(
      collection(db, 'users'),
      where('companyID', '==', companyID),
      where('isPresent', '==', true)
    );
    const s1 = await getDocs(qUsers);
    const freshMembers = s1.docs
      .map(d => ({ id: d.id, ...(d.data() as any) }))
      .filter((m: any) => m?.name && m?.email) as { id: string; name: string; email: string }[];

    // havuz: bugün seçilmiş + onaylı görünen hariç
    let pool = freshMembers.filter(
      m => !usedUsernames.includes(m.name) && !approvedNow.has(m.name)
    );

    let ordered = [...pool].sort(() => 0.5 - Math.random());
    if (ordered.length === 0) {
      pool = freshMembers.filter(m => !approvedNow.has(m.name));
      ordered = [...pool].sort(() => 0.5 - Math.random());
    }

    const finalMembers = ordered.slice(0, assignCount);
    if (finalMembers.length === 0) return;

    const shuffledPlaces = [...places].sort(() => 0.5 - Math.random());
    const ts = Timestamp.now();

    // UI objeleri
    const draft: CleaningTask[] = finalMembers.map((user, i) => ({
      id: '',
      atanan: user.name,
      tarih: ts,
      durum: 'beklemede',
      yer: shuffledPlaces[i]?.name || '-',
      email: user.email,
    }));

    // Firestore’a 'beklemede' olarak yaz + id’leri al
    const savedTasks: CleaningTask[] = [];
    for (const t of draft) {
      const ref = await addDoc(
        collection(db, 'tasks', companyID, 'temizlikGorevListesi'),
        {
          atanan: t.atanan,
          yer: t.yer || '-',
          tarih: t.tarih,
          email: t.email || '',
          durum: 'beklemede',
        }
      );
      await updateDoc(ref, { id: ref.id }); // (opsiyonel) belgeye id alanını da yaz
      savedTasks.push({ ...t, id: ref.id });
    }

    // state’e ekle
    setTasks(prev => {
      const nowMs = Date.now();
      const keep = prev.filter(
        t => t.durum === 'onaylandı' && (!t.expiresAt || t.expiresAt > nowMs)
      );
      return mergeUnique(keep, savedTasks);
    });

    // günlük used list
    setUsedUsernames(prev => {
      const next = [...prev, ...finalMembers.map(m => m.name)];
      writeUsed(companyID, todayStr, next);
      return next;
    });
    setLastAssignedDate(todayStr);

    // runner bu listeyi anında onaylayacak
    return savedTasks;
  };

  /* Onayla (Firestore'da var olanı update eder) */
  const approveTask = async (task: CleaningTask) => {
    if (!companyID) return;

    const key = `${task.atanan}-${task.tarih?.seconds || ''}`;
    setApprovingKey(key);

    const fiveMin = 5 * 60 * 1000;
    const withExpiry: CleaningTask = {
      ...task,
      durum: 'onaylandı',
      expiresAt: Date.now() + fiveMin,
    };

    // Optimistic UI + local persist (5 dk görünür)
    setTasks(prev =>
      prev.map(t =>
        t.atanan === task.atanan && t.tarih?.seconds === task.tarih?.seconds
          ? withExpiry
          : t
      )
    );
    upsertPersisted(companyID, withExpiry);

    try {
      let finalId = task.id;

      if (task.id) {
        await updateDoc(
          doc(db, 'tasks', companyID, 'temizlikGorevListesi', task.id),
          {
            durum: 'onaylandı',
            atanan: task.atanan,
            yer: task.yer || '-',
            tarih: task.tarih,
            email: task.email || '',
            id: task.id,
          }
        );
      } else {
        const ref = await addDoc(
          collection(db, 'tasks', companyID, 'temizlikGorevListesi'),
          {
            durum: 'onaylandı',
            atanan: task.atanan,
            yer: task.yer || '-',
            tarih: task.tarih,
            email: task.email || '',
          }
        );
        await updateDoc(ref, { id: ref.id });
        finalId = ref.id;

        setTasks(prev =>
          prev.map(t =>
            t.atanan === task.atanan && t.tarih?.seconds === task.tarih?.seconds
              ? { ...t, id: ref.id }
              : t
          )
        );
      }

      // Haftalık arşiv (duplikeyi engelle)
      const weekKey = getWeekStartISO();
      const weeklyRef = doc(db, 'weeklyTasks', companyID, weekKey, 'temizlikListesi');
      const weeklySnap = await getDoc(weeklyRef);
      const listKey = 'temizlikGorevListesi';
      const existing: any[] = weeklySnap.exists() ? (weeklySnap.data()?.[listKey] || []) : [];

      const idx = existing.findIndex((x: any) => x.id === finalId);
      const entry = {
        id: finalId,
        atanan: task.atanan,
        tarih: task.tarih,
        durum: 'onaylandı',
        yer: task.yer || '-',
        email: task.email || '',
      };
      if (idx >= 0) existing[idx] = entry; else existing.push(entry);

      await setDoc(weeklyRef, {
        companyID,
        createdAt: Timestamp.now(),
        [listKey]: existing,
      });

      // 🔹 E-posta (varsa) – BİLDİRİM YOK
      if (task.email) {
        await sendAssignmentEmail({
          to: task.email,
          atanan: task.atanan,
          yer: task.yer,
          tarihMs: (task.tarih?.seconds || 0) * 1000,
          taskId: finalId!,
          companyID,
          listId: 'temizlikGorevListesi',
        });
      }
    } catch (e) {
      // rollback
      setTasks(prev =>
        prev.map(t =>
          t.atanan === task.atanan && t.tarih?.seconds === task.tarih?.seconds
            ? { ...t, durum: 'beklemede', expiresAt: undefined }
            : t
        )
      );
      const list = readPersisted(companyID);
      writePersisted(
        companyID,
        list.filter(t => `${t.atanan}-${t.tarih?.seconds || ''}` !== key)
      );
      console.error(e);
      toast.error('Onaylama sırasında hata oluştu.');
    } finally {
      setApprovingKey(null);
    }
  };

  /* SİL: karttaki kırmızı X için */
  const handleDeleteTask = async (task: CleaningTask) => {
    if (!companyID) return;

    // 1) UI’den anında kaldır (optimistic)
    setTasks(prev =>
      prev.filter(t => !(t.atanan === task.atanan && t.tarih?.seconds === task.tarih?.seconds))
    );

    // 2) Onaylı kart kalıcılığını temizle
    removePersisted(companyID, task);

    // 3) Beklemede ise, aynı gün “used” listesinden ismi çıkar (tekrar atanabilsin)
    const today = new Date().toDateString();
    if (task.durum !== 'onaylandı' && lastAssignedDate === today) {
      const next = usedUsernames.filter(n => n !== task.atanan);
      setUsedUsernames(next);
      writeUsed(companyID, today, next);
    }

    // 4) Firestore’da kayıt varsa sil
    try {
      if (task.id) {
        await deleteDoc(doc(db, 'tasks', companyID, 'temizlikGorevListesi', task.id));
      }
    } catch (err) {
      console.error('Görev silme hatası:', err);
    }
  };

  /* Yerler */
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

  /* Görünen görevleri hesapla */
  const visibleTasks = tasks.filter((task) => {
    if (task.durum === 'onaylandı') {
      return !task.expiresAt || task.expiresAt > Date.now();
    }
    return lastAssignedDate
      ? new Date(task.tarih?.seconds * 1000).toDateString() === lastAssignedDate
      : true;
  });

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

      {companyID && (
        <div className="mt-6">
          <AutoAssignPanel companyID={companyID} />
        </div>
      )}

      {/* ---- ATANAN GÖREVLER (ikonlu Yer/Tarih) ---- */}
      <section className="mt-6">
        <div className="flex items-center justify-between px-2 py-2">
          <h4 className="text-sm font-semibold text-slate-800">Atanan Görevler</h4>
          <span className="text-xs text-slate-500">{visibleTasks.length} kayıt</span>
        </div>
        <div className="border-b border-slate-200/70" />

        {visibleTasks.length === 0 ? (
          <div className="px-4 py-6 text-center text-sm text-slate-500">
            Henüz görev yok.
          </div>
        ) : (
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            {visibleTasks.map((task, index) => {
              const st = statusStyles(task.durum);
              const uKey = `${task.atanan}-${task.tarih?.seconds || ''}`;
              const canApprove = task.durum === 'beklemede';
              const dateStr = new Date(task.tarih?.seconds * 1000).toLocaleDateString();

              return (
                <article
                  key={uKey + index}
                  className="relative rounded-xl border border-slate-200 bg-white shadow-sm hover:shadow-md transition"
                >
                  {/* Sol renk şeridi */}
                  <span className={`absolute inset-y-0 left-0 w-1 ${st.bar} rounded-l-xl`} />

                  <div className="p-4 grid grid-cols-[auto,1fr,auto] gap-4 items-start">
                    {/* Avatar */}
                    <div className="h-10 w-10 rounded-full bg-slate-100 grid place-items-center text-[12px] font-semibold text-slate-700">
                      {initials(task.atanan)}
                    </div>

                    {/* İçerik */}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-base font-semibold text-slate-900 truncate">{task.atanan}</p>
                        <span className={`text-[12px] px-2 py-0.5 rounded-full ${st.chip}`}>{task.durum}</span>
                      </div>

                      {/* META: Yer & Tarih */}
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        {/* Yer */}
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-50 px-2 py-0.5 text-[12px]">
                          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none">
                            <path d="M12 22s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12z" stroke="#64748b" strokeWidth="1.5" />
                            <circle cx="12" cy="10" r="2.5" stroke="#64748b" strokeWidth="1.5" />
                          </svg>
                          <span className="text-slate-500">Yer</span>
                          <span className="font-medium text-slate-800">{task.yer || '-'}</span>
                        </span>

                        {/* Tarih */}
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-50 px-2 py-0.5 text-[12px]">
                          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none">
                            <rect x="3" y="5" width="18" height="16" rx="2" stroke="#64748b" strokeWidth="1.5" />
                            <path d="M8 3v4M16 3v4M3 9h18" stroke="#64748b" strokeWidth="1.5" />
                          </svg>
                          <span className="text-slate-500">Tarih</span>
                          <span className="font-medium text-slate-800">{dateStr}</span>
                        </span>

                        {/* Onaylıysa sayaç */}
                        {task.durum === 'onaylandı' && task.expiresAt && (
                          <span className="text-[12px] text-blue-700">
                            {Math.max(0, Math.ceil((task.expiresAt - Date.now()) / 1000))} sn görünür
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Aksiyonlar */}
                    <div className="flex items-center gap-2">
                      {canApprove && (
                        <button
                          onClick={() => approveTask(task)}
                          disabled={approvingKey === uKey}
                          className="inline-flex items-center rounded-md bg-blue-600 text-white text-sm px-3 py-1.5
                               shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500/50
                               disabled:opacity-60"
                          title="Onayla"
                        >
                          ✓ Onayla
                        </button>
                      )}
                      <button
                        onClick={() => handleDeleteTask(task)}
                        className="p-2 rounded-md hover:bg-red-50 text-red-600"
                        title="Sil"
                        aria-label="Görevi sil"
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                          <path d="M6 7h12M10 11v6M14 11v6M9 7l1-2h4l1 2M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12"
                            stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
      {/* ---- /ATANAN GÖREVLER ---- */}
    </div>
  );
}
