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
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push('/');  // Eğer kullanıcı giriş yapmamışsa giriş sayfasına yönlendir
        return;
      }

      // Kullanıcının rolünü kontrol et
      const q = query(collection(db, 'uyeler'), where('email', '==', user.email));
      const snapshot = await getDocs(q);

      if (!snapshot.empty) {
        const role = snapshot.docs[0].data().role;
        if (role !== 'admin') {
          // Eğer admin değilse, member sayfasına yönlendir
          router.push('/member');
        } else {
          setCheckingAuth(false);  // Eğer adminse, admin paneline yönlendirmeye devam et
        }
      } else {
        router.push('/');  // Eğer user Firestore'da yoksa giriş sayfasına yönlendir
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

  if (checkingAuth) return null;

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-gray-100">
      {/* Sidebar */}
      <aside className="w-full md:w-64 bg-white text-black p-4 space-y-4 border-b md:border-b-0 md:border-r">
        <h1 className="text-xl font-bold mb-6">AI OFFICE MANAGER</h1>

        <button
          onClick={() => setSelected('tasks')}
          className={`flex items-center gap-2 w-full px-4 py-2 rounded-lg text-left ${selected === 'tasks' ? 'bg-gray-200' : 'hover:bg-gray-100'}`}
        >
          🛠 Admin Panel
        </button>

        <button
          onClick={() => setSelected('status')}
          className={`flex items-center gap-2 w-full px-4 py-2 rounded-lg text-left ${selected === 'status' ? 'bg-gray-200' : 'hover:bg-gray-100'}`}
        >
          👥 Member Status
        </button>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-10 text-[#1f1f1f]">
        {selected === 'tasks' && (
          <div>
            <h2 className="text-2xl font-semibold mb-6">Admin Paneli</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <button
                onClick={() => setSelected('meals')}
                className="flex flex-col items-center justify-center bg-green-50 p-6 rounded-xl shadow hover:bg-green-100 transition text-center"
              >
                <UtensilsCrossed className="w-10 h-10 mb-2" />
                <span className="text-lg font-medium">Yemek Listesi</span>
              </button>

              <button
                onClick={() => setSelected('cleaning')}
                className="flex flex-col items-center justify-center bg-green-50 p-6 rounded-xl shadow hover:bg-green-100 transition text-center"
              >
                <Brush className="w-10 h-10 mb-2" />
                <span className="text-lg font-medium">Temizlik Görevleri</span>
              </button>

              <button
                onClick={() => setSelected('history')}
                className="flex flex-col items-center justify-center bg-green-50 p-6 rounded-xl shadow hover:bg-green-100 transition text-center"
              >
                <ClipboardList className="w-10 h-10 mb-2" />
                <span className="text-lg font-medium">Geçmiş Görevler</span>
              </button>

              <button
                onClick={() => setSelected('status')}
                className="flex flex-col items-center justify-center bg-green-50 p-6 rounded-xl shadow hover:bg-green-100 transition text-center"
              >
                <Users2 className="w-10 h-10 mb-2" />
                <span className="text-lg font-medium">Giriş/Çıkış Saatleri</span>
              </button>
            </div>
          </div>
        )}

        {selected === 'meals' && <MealList />}
        {selected === 'cleaning' && <CleaningTasks />}
        {selected === 'history' && <TaskHistory />}

        {selected === 'status' && (
          <div className="bg-white p-6 rounded-xl shadow mt-10">
            <h3 className="text-xl font-semibold mb-4">Member Status</h3>
            <div className="grid grid-cols-3 text-sm font-semibold text-gray-500 border-b pb-2">
              <span className="text-left">Name</span>
              <span className="text-center">Status</span>
              <span className="text-right">Role</span>
            </div>

            {members.map((member, index) => (
              <div
                key={index}
                className="grid grid-cols-3 py-2 border-b last:border-none items-center"
              >
                <span className="text-[#1f1f1f] font-medium text-left">{member.name}</span>

                <div className="flex justify-center">
                  <button
                    onClick={() => togglePresence(member.id, member.isPresent)}
                    className={`px-3 py-1 rounded-full text-xs font-semibold ${member.isPresent
                      ? 'bg-green-100 text-green-800'
                      : 'bg-gray-100 text-gray-800'
                      }`}
                  >
                    {member.isPresent ? 'Ofiste' : 'Dışarıda'}
                  </button>
                </div>

                <div className="flex justify-end">
                  <button
                    onClick={() => toggleAdmin(member.id, member.role)}
                    className={`px-3 py-1 rounded-full text-xs font-semibold transition duration-150 ${member.role === 'admin'
                      ? 'bg-red-100 text-red-800 hover:bg-red-200'
                      : 'bg-blue-100 text-blue-800 hover:bg-blue-200'
                      }`}
                  >
                    {member.role === 'admin' ? 'Adminliği Kaldır' : 'Admin Yap'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
