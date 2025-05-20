'use client';

import { useEffect, useState } from 'react';
import { db } from '../lib/firebase';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { collection, getDocs, query, where, doc, updateDoc } from 'firebase/firestore';
import MealList from './components/MealList';
import CleaningTasks from './components/CleaningTasks';
import TaskHistory from './components/TaskHistory';
import {
  ClipboardList,
  UtensilsCrossed,
  Brush,
  Users2,
} from 'lucide-react';

export default function AdminDashboard() {
  const router = useRouter();
  const auth = getAuth();
  const [members, setMembers] = useState<{ id: string; name: string; isPresent: boolean; role: string }[]>([]);
  const [selected, setSelected] = useState<'tasks' | 'meals' | 'cleaning' | 'status' | 'history'>('tasks');
  const [meals, setMeals] = useState<{ atanan: string; görev: string; tarih: any; durum: string }[]>([]);
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push('/');
        return;
      }

      const q = query(collection(db, 'uyeler'), where('email', '==', user.email));
      const snapshot = await getDocs(q);

      if (!snapshot.empty) {
        const role = snapshot.docs[0].data().role;
        if (role !== 'admin') {
          router.push('/member');
        } else {
          setCheckingAuth(false);
        }
      } else {
        router.push('/');
      }
    });

    return () => unsubscribe();
  }, [auth, router]);

  useEffect(() => {
    const fetchMembers = async () => {
      const snapshot = await getDocs(collection(db, 'uyeler'));
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setMembers(data as any);
    };
    fetchMembers();
  }, []);

  useEffect(() => {
    const fetchMeals = async () => {
      const snapshot = await getDocs(collection(db, 'yemekGorevleri'));
      const data = snapshot.docs.map((doc) => doc.data() as {
        atanan: string;
        görev: string;
        tarih: any;
        durum: string;
      });
      setMeals(data);
    };
    fetchMeals();
  }, []);

  const togglePresence = async (id: string, current: boolean) => {
    const ref = doc(db, 'uyeler', id);
    await updateDoc(ref, { isPresent: !current });
    setMembers((prev) =>
      prev.map((m) => (m.id === id ? { ...m, isPresent: !current } : m))
    );
  };

  const toggleAdmin = async (id: string, currentRole: string) => {
    const ref = doc(db, 'uyeler', id);
    const newRole = currentRole === 'admin' ? 'member' : 'admin';
    await updateDoc(ref, { role: newRole });
    setMembers((prev) =>
      prev.map((m) => (m.id === id ? { ...m, role: newRole } : m))
    );
  };

  const today = new Date().toDateString();
  const todayAssigned = meals.find(
    (m) => new Date(m.tarih?.seconds * 1000).toDateString() === today
  )?.atanan;

  if (checkingAuth) return null;

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-gray-100">
      <aside className="w-full md:w-64 bg-white text-black p-4 space-y-4 border-b md:border-b-0 md:border-r">
        <h1 className="text-xl font-bold mb-6">AI OFFICE MANAGER</h1>
        <button onClick={() => setSelected('tasks')} className={`flex items-center gap-2 w-full px-4 py-2 rounded-lg text-left ${selected === 'tasks' ? 'bg-gray-200' : 'hover:bg-gray-100'}`}>
          <ClipboardList className="w-5 h-5" /> Task Assignments
        </button>
        <button onClick={() => setSelected('meals')} className={`flex items-center gap-2 w-full px-4 py-2 rounded-lg text-left ${selected === 'meals' ? 'bg-gray-200' : 'hover:bg-gray-100'}`}>
          <UtensilsCrossed className="w-5 h-5" /> Meal List
        </button>
        <button onClick={() => setSelected('cleaning')} className={`flex items-center gap-2 w-full px-4 py-2 rounded-lg text-left ${selected === 'cleaning' ? 'bg-gray-200' : 'hover:bg-gray-100'}`}>
          <Brush className="w-5 h-5" /> Cleaning Tasks
        </button>
        <button onClick={() => setSelected('status')} className={`flex items-center gap-2 w-full px-4 py-2 rounded-lg text-left ${selected === 'status' ? 'bg-gray-200' : 'hover:bg-gray-100'}`}>
          <Users2 className="w-5 h-5" /> Member Status
        </button>
        <button onClick={() => setSelected('history')} className={`flex items-center gap-2 w-full px-4 py-2 rounded-lg text-left ${selected === 'history' ? 'bg-gray-200' : 'hover:bg-gray-100'}`}>
          📜 Task History
        </button>
      </aside>

      <main className="flex-1 p-4 md:p-10 text-[#1f1f1f]">
        <h2 className="text-2xl md:text-3xl font-bold mb-6">Admin</h2>

        {selected === 'tasks' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-xl shadow">
              <h3 className="text-lg font-medium text-gray-600 mb-1">Today's Meal Duty</h3>
              <p className="text-2xl font-semibold">{todayAssigned || 'Henüz atanmadı'}</p>
            </div>
            <div className="bg-white p-6 rounded-xl shadow">
              <h3 className="text-lg font-medium text-gray-600 mb-1">Total Assigned Tasks</h3>
              <p className="text-2xl font-semibold">{meals.length} Tasks</p>
            </div>
          </div>
        )}

        {selected === 'meals' && <MealList />}
        {selected === 'cleaning' && <CleaningTasks />}
        {selected === 'history' && <TaskHistory />}

        {selected === 'status' && (
          <div className="bg-white p-6 rounded-xl shadow mt-10">
            <h3 className="text-xl font-semibold mb-4">Member Status</h3>
            <div className="grid grid-cols-3 text-sm font-medium text-gray-500 border-b pb-2">
              <span>Name</span>
              <span>Status</span>
              <span>Role</span>
            </div>
            {members.map((member, index) => (
              <div key={index} className="grid grid-cols-3 py-2 border-b last:border-none items-center">
                <span className="text-[#1f1f1f] font-medium">{member.name}</span>
                <button
                  onClick={() => togglePresence(member.id, member.isPresent)}
                  className={`px-3 py-1 rounded-full text-xs font-semibold inline-block w-fit ${member.isPresent ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}
                >
                  {member.isPresent ? 'Ofiste' : 'Dışarıda'}
                </button>
                <button
                  onClick={() => toggleAdmin(member.id, member.role)}
                  className={`px-3 py-1 rounded-full text-xs font-semibold ${member.role === 'admin' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'}`}
                >
                  {member.role === 'admin' ? 'Adminliği Kaldır' : 'Admin Yap'}
                </button>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}