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
    onSnapshot,
} from 'firebase/firestore';

interface Task {
    id: string;
    atanan: string;
    tarih: any;
    durum: string;
    yer: string;
}

export default function MyTasks() {
    const [tasks, setTasks] = useState<Task[]>([]);
    const [userUid, setUserUid] = useState<string | null>(null);
    const auth = getAuth();

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                setUserUid(user.uid);
            }
        });

        return () => unsubscribe();
    }, []);

    useEffect(() => {
        if (!userUid) return;

        const unsubscribeTasks = onSnapshot(
            collection(db, `users/${userUid}/tasks`),
            (snapshot) => {
                const data = snapshot.docs.map((doc) => ({
                    id: doc.id,
                    ...doc.data(),
                })) as Task[];
                setTasks(data);
            }
        );

        return () => unsubscribeTasks();
    }, [userUid]);

    const markAsDone = async (task: Task) => {
  if (!userUid) return;

  const taskRef = doc(db, `users/${userUid}/tasks`, task.id);
  await updateDoc(taskRef, { durum: 'tamamlandı' });

  await addDoc(collection(db, `users/${userUid}/logs`), {
    atanan: task.atanan,
    tarih: task.tarih,
    gorev: 'temizlik', // veya dışarıdan gelen props ile dinamikleştirilebilir
  });

  setTasks((prev) =>
    prev.map((t) => (t.id === task.id ? { ...t, durum: 'tamamlandı' } : t))
  );
};


    return (
        <div className="p-4">
            <h2 className="text-3xl font-bold mb-6">My Tasks</h2>

            {tasks.length === 0 ? (
                <p className="text-gray-500 bg-white p-4 rounded shadow">
                    Şu anda atanan bir göreviniz yok.
                </p>
            ) : (
                <div className="space-y-4">
                    {tasks.map((task) => {
                        const timestamp = task.tarih?.seconds
                            ? new Date(task.tarih.seconds * 1000)
                            : null;

                        const formattedDate = timestamp
                            ? timestamp.toLocaleDateString('en-US', {
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
                                className="bg-white rounded-xl shadow p-5 flex justify-between items-center"
                            >
                                <div className="text-lg font-semibold text-black">
                                    {task.yer || 'Bilinmeyen Görev'}
                                </div>
                                <div className="text-right space-y-1">
                                    <div
                                        className={`text-xs inline-block px-3 py-1 rounded-full font-medium ${durumRengi}`}
                                    >
                                        {task.durum}
                                    </div>
                                    <div className="text-sm text-gray-500">{formattedDate}</div>
                                    {task.durum === 'onaylandı' && (
                                        <button
                                            onClick={() => markAsDone(task)}
                                            className="mt-1 text-xs bg-green-600 text-white px-3 py-1 rounded"
                                        >
                                            Tamamla
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
