'use client';

import { useEffect, useState } from 'react';
import { db } from '../../lib/firebase';
import { collection, getDocs } from 'firebase/firestore';

export default function TaskAssignments() {
    const [completedMeals, setCompletedMeals] = useState<any[]>([]);
    const [completedCleaning, setCompletedCleaning] = useState<any[]>([]);

    useEffect(() => {
        const fetchCompletedTasks = async () => {
            const todayStr = new Date().toDateString();

            // Yemek görevleri
            const mealSnap = await getDocs(collection(db, 'yemekGorevleri'));
            const mealData = mealSnap.docs
                .map((doc) => doc.data())
                .filter(
                    (task) =>
                        new Date(task.tarih?.seconds * 1000).toDateString() === todayStr &&
                        task.durum === 'tamamlandı'
                );
            setCompletedMeals(mealData);

            // Temizlik görevleri
            const cleaningSnap = await getDocs(collection(db, 'temizlikGorevleri'));
            const cleaningData = cleaningSnap.docs
                .map((doc) => doc.data())
                .filter(
                    (task) =>
                        new Date(task.tarih?.seconds * 1000).toDateString() === todayStr &&
                        task.durum === 'tamamlandı'
                );
            setCompletedCleaning(cleaningData);
        };

        fetchCompletedTasks();
    }, []);

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* Yemek Görevleri */}
            <div className="bg-white p-6 rounded-xl shadow border">
                <h3 className="text-sm font-semibold text-gray-500 uppercase mb-3">Tamamlanan Yemek Görevleri</h3>
                {completedMeals.length > 0 ? (
                    <ul className="space-y-2">
                        {completedMeals.map((task, i) => (
                            <li key={i} className="flex justify-between text-gray-800 font-medium">
                                {task.atanan}
                                <span className="text-green-600 text-sm">✓ tamamlandı</span>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="text-gray-400 italic">Henüz tamamlanan görev yok</p>
                )}
            </div>

            {/* Temizlik Görevleri */}
            <div className="bg-white p-6 rounded-xl shadow border">
                <h3 className="text-sm font-semibold text-gray-500 uppercase mb-3">Tamamlanan Temizlik Görevleri</h3>
                {completedCleaning.length > 0 ? (
                    <ul className="space-y-2">
                        {completedCleaning.map((task, i) => (
                            <li key={i} className="flex justify-between text-gray-800 font-medium">
                                {task.atanan}
                                <span className="text-green-600 text-sm">✓ tamamlandı</span>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="text-gray-400 italic">Henüz tamamlanan görev yok</p>
                )}
            </div>
        </div>
    );
}
