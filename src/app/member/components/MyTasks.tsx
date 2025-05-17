'use client';

import { useEffect, useState } from 'react';
import { db } from '../../lib/firebase';
import { getAuth } from 'firebase/auth';
import {
    collection,
    getDocs,
    query,
    where,
    doc,
    updateDoc,
    addDoc,
} from 'firebase/firestore';
type Task = {
    id: string;
    atanan: string;
    tarih: any;
    durum: string;
    gorev: string; // ❌ bu çözüm önerilmez, type checking zayıflar
};

export default function MyTasks() {
    const auth = getAuth();
    const [tasks, setTasks] = useState<Task[]>([]);

    useEffect(() => {
        const fetchMyTasks = async () => {
            const currentUser = auth.currentUser;
            if (!currentUser) return;
            const todayStr = new Date().toDateString();

            // Yemek görevlerini çek
            const mealQuery = query(
                collection(db, 'yemekGorevleri'),
                where('email', '==', currentUser.email),
                where('durum', '==', 'onaylandı')
            );

            // Temizlik görevlerini çek
            const cleanQuery = query(
                collection(db, 'temizlikGorevleri'),
                where('email', '==', currentUser.email),
                where('durum', '==', 'onaylandı')
            );

            // İkisini birden al
            const [mealSnap, cleanSnap] = await Promise.all([
                getDocs(mealQuery),
                getDocs(cleanQuery),
            ]);

            // Yemek görevlerini dönüştür
            const meals = mealSnap.docs.map((doc) => ({
                id: doc.id,
                ...(doc.data() as Omit<Task, 'id' | 'gorev'>),
                gorev: 'yemek',
            }));

            // Temizlik görevlerini dönüştür
            const cleans = cleanSnap.docs.map((doc) => ({
                id: doc.id,
                ...(doc.data() as Omit<Task, 'id' | 'gorev'>),
                gorev: 'temizlik',
            }));

            // Sadece bugünkü görevler
            const combined = [...meals, ...cleans].filter(
                (task) =>
                    new Date(task.tarih?.seconds * 1000).toDateString() === todayStr
            );

            setTasks(combined);
        };

        fetchMyTasks();
    }, []);

    // Görevi tamamlandı olarak işaretle
    const markAsDone = async (task: Task) => {
        const ref = doc(db, task.gorev === 'yemek' ? 'yemekGorevleri' : 'temizlikGorevleri', task.id);
        await updateDoc(ref, { durum: 'tamamlandı' });

        await addDoc(collection(db, 'gorevGecmisi'), {
            atanan: task.atanan,
            tarih: task.tarih,
            gorev: task.gorev,
        });

        setTasks((prev) =>
            prev.map((t) => (t.id === task.id ? { ...t, durum: 'tamamlandı' } : t))
        );
    };

    return (
        <div className="p-6 bg-white rounded-xl shadow mt-6">
            <h2 className="text-xl font-bold mb-4">Bugünkü Görevlerim</h2>
            {tasks.length === 0 ? (
                <p className="text-gray-500">Bugün için atanmış bir göreviniz yok.</p>
            ) : (
                <ul className="space-y-4">
                    {tasks.map((task, i) => (
                        <li
                            key={i}
                            className="flex justify-between items-center border-b pb-2 last:border-none"
                        >
                            <div>
                                <p className="font-medium capitalize">{task.gorev} görevi</p>
                                <p className="text-sm text-gray-500">
                                    {new Date(task.tarih?.seconds * 1000).toLocaleDateString()}
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                <span
                                    className={`text-xs px-2 py-1 rounded-full font-medium ${task.durum === 'tamamlandı'
                                        ? 'bg-green-100 text-green-800'
                                        : 'bg-yellow-100 text-yellow-800'
                                        }`}
                                >
                                    {task.durum}
                                </span>
                                {task.durum !== 'tamamlandı' && (
                                    <button
                                        onClick={() => markAsDone(task)}
                                        className="text-xs bg-green-500 text-white px-3 py-1 rounded"
                                    >
                                        Yapıldı
                                    </button>
                                )}
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
