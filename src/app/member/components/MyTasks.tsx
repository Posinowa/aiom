'use client';

import { useEffect, useState } from 'react';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { db } from '../../lib/firebase';
import {
    collection,
    query,
    where,
    onSnapshot,
    doc,
    getDocs,
    getDoc,
    updateDoc,
    addDoc,
    serverTimestamp,
} from 'firebase/firestore';
import { toast } from 'react-hot-toast';

interface Task {
    id: string;
    atanan: string;
    tarih: any;
    durum: string;
    yer: string;
    tip: 'yemek' | 'temizlik';
    source: 'old' | 'weekly';
    weekDate?: string;
}

export default function MyTasks() {
    const [tasks, setTasks] = useState<Task[]>([]);
    const [userInfo, setUserInfo] = useState<{ uid: string; name: string; companyID: string } | null>(null);
    const auth = getAuth();

    const getWeekDate = () => {
        const today = new Date();
        const monday = new Date(today);
        monday.setDate(today.getDate() - today.getDay() + 1); // Pazartesi
        return monday.toISOString().split('T')[0];
    };

    // Kullanıcı bilgilerini dinle
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

    // Görevleri realtime (onSnapshot) dinle
    useEffect(() => {
        if (!userInfo) return;
        const { companyID, name } = userInfo;
        const weekDate = getWeekDate();

        // Sadece bu kullanıcının görevlerini filtreleyen sorgular
        const oldTemizlikQuery = query(
            collection(db, `tasks/${companyID}/temizlikGorevListesi`),
            where('atanan', '==', name)
        );
        const oldYemekQuery = query(
            collection(db, `tasks/${companyID}/yemekGorevListesi`),
            where('atanan', '==', name)
        );

        // Real-time dinleme için unsubscribeler
        const unsubTemizlik = onSnapshot(oldTemizlikQuery, (snapshot) => {
            const temizlikTasks = snapshot.docs.map((doc) => ({
                id: doc.id,
                ...doc.data(),
                tip: 'temizlik',
                source: 'old',
            })) as Task[];

            setTasks((prev) => {
                // Günlük temizlik görevlerini güncelle, diğer görevleri koru
                const otherTasks = prev.filter((t) => t.tip !== 'temizlik' || t.source !== 'old');
                return [...otherTasks, ...temizlikTasks];
            });
        });

        const unsubYemek = onSnapshot(oldYemekQuery, (snapshot) => {
            const yemekTasks = snapshot.docs.map((doc) => ({
                id: doc.id,
                ...doc.data(),
                tip: 'yemek',
                source: 'old',
            })) as Task[];

            setTasks((prev) => {
                // Günlük yemek görevlerini güncelle, diğer görevleri koru
                const otherTasks = prev.filter((t) => t.tip !== 'yemek' || t.source !== 'old');
                return [...otherTasks, ...yemekTasks];
            });
        });

        // Haftalık görevler için dinlemeyi da ekleyelim
        const weeklyTemizlikRef = doc(db, `weeklyTasks/${companyID}/${weekDate}/temizlikListesi`);
        const weeklyYemekRef = doc(db, `weeklyTasks/${companyID}/${weekDate}/yemekListesi`);


        // Temizleme
        return () => {
            unsubTemizlik();
            unsubYemek();
        };
    }, [userInfo]);

    // Görevlerim ekranında sadece bugünkü görevlerin görünmesi için filtre uyguluyoruz
    const todayStr = new Date().toDateString();
    const filteredTasks = tasks.filter((task) => {
        const taskDate = task.tarih?.seconds ? new Date(task.tarih.seconds * 1000).toDateString() : '';
        return taskDate === todayStr && task.durum === 'onaylandı'; // ✅ sadece onaylananlar gösterilir
    });


    const markAsDone = async (task: Task) => {
        if (!userInfo) return;
        const { companyID } = userInfo;

        try {
            // 🔹 GÖREV DURUMUNU GÜNCELLE
            if (task.source === 'old') {
                const ref = doc(
                    db,
                    `tasks/${companyID}/${task.tip === 'yemek' ? 'yemekGorevListesi' : 'temizlikGorevListesi'}/${task.id}`
                );
                const snap = await getDoc(ref);
                if (snap.exists()) {
                    await updateDoc(ref, { durum: 'tamamlandı' });
                }
            } else if (task.source === 'weekly' && task.weekDate) {
                const ref = doc(
                    db,
                    `weeklyTasks/${companyID}/${task.weekDate}/${task.tip === 'yemek' ? 'yemekListesi' : 'temizlikListesi'}`
                );
                const snap = await getDoc(ref);
                if (!snap.exists()) return;

                const data = snap.data();
                const listKey = task.tip === 'yemek' ? 'yemekGorevListesi' : 'temizlikGorevListesi';
                const originalList = data[listKey] || [];

                const updatedList = originalList.map((t: any) =>
                    t.atanan === task.atanan && t.tarih?.seconds === task.tarih?.seconds
                        ? { ...t, durum: 'tamamlandı' }
                        : t
                );
                await updateDoc(ref, { [listKey]: updatedList });
            }

            // 🔒 TEKRAR KAYIT KONTROLÜ
            const existingQuery = query(
                collection(db, 'gorevGecmisi'),
                where('atanan', '==', task.atanan),
                where('tarih', '==', task.tarih),
                where('gorev', '==', task.tip)
            );
            const existingSnap = await getDocs(existingQuery);

            if (existingSnap.empty) {
                await addDoc(collection(db, 'gorevGecmisi'), {
                    atanan: task.atanan,
                    tarih: task.tarih,
                    gorev: task.tip,
                    createdAt: serverTimestamp(),

                });

                // ✅ TAM BURADA TOAST GÖSTER
                toast.success(`✅ ${task.tip === 'temizlik' ? 'Temizlik' : 'Yemek'} görevin başarıyla tamamlandı!`);
            }

            // 🔄 LOKAL STATE GÜNCELLE
            setTasks((prev) =>
                prev.map((t) => (t.id === task.id ? { ...t, durum: 'tamamlandı' } : t))
            );
        } catch (err) {
            console.error('markAsDone hatası:', err);
        }
    };

    return (
        <div className="p-4">
            <h2 className="text-2xl font-semibold mb-4">Görevlerim</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {filteredTasks.map((task) => {
                    const timestamp = task.tarih?.seconds ? new Date(task.tarih.seconds * 1000) : null;
                    const formattedDate = timestamp
                        ? timestamp.toLocaleDateString('tr-TR', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                        })
                        : 'Tarih yok';

                    const badgeText = task.tip === 'temizlik' ? '🧼 Temizlik Görevi' : '🍽️ Yemek Görevi';
                    const badgeColor = task.tip === 'temizlik' ? 'bg-blue-100 text-blue-800' : 'bg-yellow-100 text-yellow-800';

                    return (
                        <div
                            key={task.id}
                            className="bg-white rounded-xl shadow p-5 border flex flex-col justify-between"
                        >
                            {/* Görev Kaynağı Etiketi */}
                            <span
                                className={`text-xs font-semibold px-2 py-1 rounded-full self-start mb-2 ${badgeColor}`}
                            >
                                {badgeText}
                            </span>

                            {/* Bilgiler */}
                            <div className="space-y-1">
                                <p className="text-sm font-medium">Atanan: {task.atanan}</p>
                                <p className="text-xs text-gray-500">Yer: {task.yer || '-'}</p>
                                <p className="text-xs text-gray-500">Tarih: {formattedDate}</p>
                            </div>

                            {/* Buton ve Durum */}
                            <div className="flex items-center justify-between mt-3">
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
                                {task.durum === 'onaylandı' && (
                                    <button
                                        onClick={() => markAsDone(task)}
                                        className="text-xs bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded"
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
    );
}
