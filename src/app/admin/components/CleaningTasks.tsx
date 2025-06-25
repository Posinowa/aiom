// components/CleaningTasks.tsx
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

const GIRL_NAMES = ['esma sahin', 'dilara yilmaz', 'feyza sahin'];

export default function CleaningTasks() {
    const [members, setMembers] = useState<{ id: string; name: string; email: string }[]>([]);
    const [tasks, setTasks] = useState<CleaningTask[]>([]);
    const [places, setPlaces] = useState<CleaningPlace[]>([]);
    const [newPlace, setNewPlace] = useState('');
    const [assignCount, setAssignCount] = useState<number>(2);
    const [loading, setLoading] = useState(false);
    const [tasksAssigned, setTasksAssigned] = useState(false);
    const [allowDuplicateToday, setAllowDuplicateToday] = useState(false);

    const todayStr = new Date().toDateString();

    useEffect(() => {
        const fetchMembers = async () => {
            const snapshot = await getDocs(query(collection(db, 'uyeler'), where('isPresent', '==', true)));
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];
            setMembers(
                data
                    .filter(m => m.name !== 'admin@ai.com')
                    .map(m => ({ id: m.id, name: m.name, email: m.email }))
            );
        };

        const fetchPlaces = async () => {
            const snapshot = await getDocs(collection(db, 'temizlikYerleri'));
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as CleaningPlace[];
            setPlaces(data);
        };

        const fetchTasks = async () => {
            const snapshot = await getDocs(collection(db, 'temizlikGorevleri'));
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as CleaningTask[];
            setTasks(data);
        };

        fetchMembers();
        fetchPlaces();
        fetchTasks();
    }, []);
    const assignCleaningTasks = async () => {
        setLoading(true);

        const snapshot = await getDocs(collection(db, 'temizlikGorevleri'));
        const allTasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as CleaningTask[];
        const assignedToday = allTasks
            .filter(t => new Date(t.tarih?.seconds * 1000).toDateString() === todayStr)
            .map(t => t.atanan);

        const availableMembers = allowDuplicateToday
            ? members
            : members.filter(m => !assignedToday.includes(m.name));

        if (availableMembers.length < assignCount) {
            alert('Yeterli sayıda yeni görev atanabilecek kişi kalmadı.');
            setLoading(false);
            return;
        }

        const shuffled = [...availableMembers].sort(() => 0.5 - Math.random());
        const selected = shuffled.slice(0, assignCount); // ✅ atama yapılacak kadar üye seç
        const shuffledPlaces = [...places].sort(() => 0.5 - Math.random());
        const newTasks: CleaningTask[] = []; // ✅ Önceden tanımla

        for (let i = 0; i < selected.length; i++) {
            const user = selected[i];

            if (!user.name) {
                console.warn(`⚠️ Kullanıcının ismi yok:`, user);
                continue;
            }

            const task = {
                id: '',
                atanan: user.name,
                tarih: Timestamp.now(),
                durum: 'beklemede',
                yer: shuffledPlaces[i]?.name || '-',
                email: user.email,
            };

            try {
                const docRef = await addDoc(collection(db, 'temizlikGorevleri'), task);
                await addDoc(collection(db, `users/${user.id}/tasks`), {
                    ...task,
                    id: docRef.id,
                });

                newTasks.push({ ...task, id: docRef.id }); // ✅ Artık tanımlı
            } catch (error) {
                console.error(`❌ Görev eklenemedi:`, error);
            }
        }

        setTasks(prev => [
            ...prev.filter(t => new Date(t.tarih?.seconds * 1000).toDateString() !== todayStr),
            ...newTasks,
        ]);

        setTasksAssigned(true);
        setLoading(false);
    };


    const addPlace = async () => {
        if (!newPlace.trim()) return;
        await addDoc(collection(db, 'temizlikYerleri'), { name: newPlace.trim() });
        setNewPlace('');
        const snapshot = await getDocs(collection(db, 'temizlikYerleri'));
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as CleaningPlace[];
        setPlaces(data);
    };

    const clearPlaces = async () => {
        const snapshot = await getDocs(collection(db, 'temizlikYerleri'));
        for (const docu of snapshot.docs) {
            await deleteDoc(doc(db, 'temizlikYerleri', docu.id));
        }
        setPlaces([]);
    };

    const approveTask = async (task: CleaningTask) => {
        // 1. Görevin global durumunu güncelle
        await updateDoc(doc(db, 'temizlikGorevleri', task.id), { durum: 'onaylandı' });

        // 2. Ekranda güncellenmiş haliyle göster
        setTasks(prev =>
            prev.map(t => (t.id === task.id ? { ...t, durum: 'onaylandı' } : t))
        );

        // 3. Görevi kullanıcıya da yaz (users/{uid}/tasks)
        await approveTaskAndAssignToUser({
            ...task,
            assignedEmail: task.email, // 🔐 UID eşleşmesi için gerekli
            id: task.id                // 🔑 Firestore görev ID'si
        });
    };


    return (
        <div className="bg-white p-6 rounded-xl shadow mt-10">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-2">
                <h3 className="text-xl font-semibold">Cleaning Tasks</h3>
                <div className="flex gap-2">
                    <input
                        type="number"
                        value={assignCount}
                        onChange={e => setAssignCount(parseInt(e.target.value) || 2)}
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
                    onChange={e => setNewPlace(e.target.value)}
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

            {!tasksAssigned ? (
                <p className="text-sm text-gray-500">Henüz görev ataması yapılmadı.</p>
            ) : (
                <div className="space-y-4">
                    {tasks
                        .filter(task => new Date(task.tarih?.seconds * 1000).toDateString() === todayStr)
                        .map((task, index) => (
                            <div key={index} className="flex justify-between items-center border-b pb-2 last:border-none">
                                <div>
                                    <p className="text-sm font-medium">Atanan: {task.atanan}</p>
                                    <p className="text-xs text-gray-500">Yer: {task.yer || '-'}</p>
                                    <p className="text-xs text-gray-500">
                                        Tarih: {new Date(task.tarih?.seconds * 1000).toLocaleDateString()}
                                    </p>
                                </div>
                                <div className="flex items-center gap-2">
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
            )}
        </div>
    );
}
