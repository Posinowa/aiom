'use client';

import { useEffect, useState } from 'react';
import { db } from '../../lib/firebase';
import { collection, getDocs } from 'firebase/firestore';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';

export default function TaskHistory() {
    const [groupedHistory, setGroupedHistory] = useState<Record<string, { atanan: string; gorev: string }[]>>({});

    useEffect(() => {
        const fetchHistory = async () => {
            const snapshot = await getDocs(collection(db, 'gorevGecmisi'));
            const data = snapshot.docs.map((doc) => doc.data() as { atanan: string; tarih: any; gorev: string });

            const grouped: Record<string, { atanan: string; gorev: string }[]> = {};

            data.forEach((item) => {
                const date = new Date(item.tarih?.seconds * 1000);
                const key = format(date, "EEEE - dd/MM/yyyy", { locale: tr });

                if (!grouped[key]) grouped[key] = [];
                grouped[key].push({ atanan: item.atanan, gorev: item.gorev });
            });

            setGroupedHistory(grouped);
        };
        fetchHistory();
    }, []);

    return (
        <div className="bg-white p-6 rounded-xl shadow mt-10">
            <h3 className="text-xl font-semibold mb-4">Görev Geçmişi (Haftalık)</h3>
            <div className="space-y-6">
                {Object.entries(groupedHistory).map(([day, tasks], i) => (
                    <div key={i}>
                        <h4 className="text-md font-bold text-gray-700 mb-2">{day}</h4>
                        <ul className="space-y-1">
                            {tasks.map((task, index) => (
                                <li key={index} className="flex justify-between text-sm">
                                    <span>{task.atanan}</span>
                                    <span className="bg-gray-100 px-2 py-1 rounded text-xs text-gray-700">{task.gorev}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                ))}
            </div>
        </div>
    );
}
