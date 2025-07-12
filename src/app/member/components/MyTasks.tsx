'use client';

import { useEffect, useState } from 'react';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { db } from '../../lib/firebase';
import {
    collection,
    getDocs,
    updateDoc,
    doc,
    addDoc,
    query,
    where,
} from 'firebase/firestore';

interface Task {
    id: string;
    atanan: string;
    tarih: any;
    durum: string;
    yer: string;
    tip: 'yemek' | 'temizlik';
}

export default function MyTasks() {
    const [tasks, setTasks] = useState<Task[]>([]);
    const [userInfo, setUserInfo] = useState<{ uid: string; name: string; companyID: string } | null>(null);
    const auth = getAuth();

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                const uid = user.uid;
                const userSnap = await getDocs(query(collection(db, 'users'), where('email', '==', user.email)));
                if (!userSnap.empty) {
                    const userData = userSnap.docs[0].data();
                    setUserInfo({
                        uid,
                        name: userData.name,
                        companyID: userData.companyID,
                    });
                }
            }
        });

        return () => unsubscribe();
    }, []);

    useEffect(() => {
        if (!userInfo) return;

        const fetchTasks = async () => {
            const { companyID, name } = userInfo;

            const temizlikRef = collection(db, `tasks/${companyID}/temizlikGorevListesi`);
            const yemekRef = collection(db, `tasks/${companyID}/yemekGorevListesi`);

            const temizlikSnap = await getDocs(query(temizlikRef, where('atanan', '==', name)));
            const yemekSnap = await getDocs(query(yemekRef, where('atanan', '==', name)));

            const temizlikTasks = temizlikSnap.docs.map((doc) => ({
                id: doc.id,
                ...doc.data(),
                tip: 'temizlik',
            })) as Task[];

            const yemekTasks = yemekSnap.docs.map((doc) => ({
                id: doc.id,
                ...doc.data(),
                tip: 'yemek',
            })) as Task[];

            setTasks([...temizlikTasks, ...yemekTasks]);
        };

        fetchTasks();
    }, [userInfo]);

    const markAsDone = async (task: Task) => {
        if (!userInfo) return;

        const ref = doc(db, `tasks/${userInfo.companyID}/${task.tip === 'yemek' ? 'yemekGorevListesi' : 'temizlikGorevListesi'}/${task.id}`);
        await updateDoc(ref, { durum: 'tamamlandı' });

        await addDoc(collection(db, 'gorevGecmisi'), {
            atanan: task.atanan,
            tarih: task.tarih,
            gorev: task.tip,
        });

        setTasks((prev) =>
            prev.map((t) => (t.id === task.id ? { ...t, durum: 'tamamlandı' } : t))
        );
    };

    const groupedTasks = {
        yemek: tasks.filter((t) => t.tip === 'yemek'),
        temizlik: tasks.filter((t) => t.tip === 'temizlik'),
    };

    return (
        <div className="p-4">
            <h2 className="text-3xl font-bold mb-6">My Tasks</h2>

            {tasks.length === 0 ? (
                <p className="text-gray-500 bg-white p-4 rounded shadow">
                    Şu anda atanan bir göreviniz yok.
                </p>
            ) : (
                <div className="space-y-8">
                    {(['yemek', 'temizlik'] as const).map((tip) => (
                        groupedTasks[tip].length > 0 && (
                            <div key={tip}>
                                <h3 className="text-xl font-semibold mb-2 text-gray-800 border-b pb-1">
                                    {tip === 'yemek' ? '🍽️ Yemek Görevleri' : '🧼 Temizlik Görevleri'}
                                </h3>
                                <div className="space-y-4">
                                    {groupedTasks[tip].map((task) => {
                                        const timestamp = task.tarih?.seconds
                                            ? new Date(task.tarih.seconds * 1000)
                                            : null;

                                        const formattedDate = timestamp
                                            ? timestamp.toLocaleDateString('tr-TR', {
                                                year: 'numeric',
                                                month: 'short',
                                                day: 'numeric',
                                            })
                                            : 'Tarih yok';

                                        const durumRengi =
                                            task.durum === 'tamamlandı'
                                                ? 'bg-green-100 text-green-800'
                                                : task.durum === 'onaylandı'
                                                    ? 'bg-blue-100 text-blue-800'
                                                    : 'bg-orange-100 text-orange-800';

                                        return (
                                            <div
                                                key={task.id}
                                                className="bg-white rounded-xl shadow p-5 flex justify-between items-center border"
                                            >
                                                <div className="flex items-center space-x-2">
                                                    <div
                                                        className={`text-xs inline-block px-3 py-1 rounded-full font-medium ${durumRengi}`}
                                                    >
                                                        {task.durum}
                                                    </div>
                                                    <div className="text-sm text-gray-500">{formattedDate}</div>
                                                    {task.durum === 'onaylandı' && (
                                                        <button
                                                            onClick={() => markAsDone(task)}
                                                            className="text-xs bg-green-600 text-white px-3 py-1 rounded"
                                                        >
                                                            Tamamla
                                                        </button>
                                                    )}
                                                </div>

                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )
                    ))}
                </div>
            )}
        </div>
    );
}
