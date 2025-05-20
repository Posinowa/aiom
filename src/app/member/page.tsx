'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { UserCircle, CheckSquare } from 'lucide-react';
import { db } from '../lib/firebase';
import { collection, getDocs, doc, updateDoc, onSnapshot } from 'firebase/firestore';
import { getAuth, onAuthStateChanged } from 'firebase/auth';

export default function Dashboard() {
  const [selected, setSelected] = useState<'status' | 'tasks'>('status');
  const [members, setMembers] = useState<{ id: string; name: string; isPresent: boolean }[]>([]);
  const [tasks, setTasks] = useState<string[]>([]);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const router = useRouter();

  const auth = getAuth();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        router.push('/'); // Giriş yapmamışsa login sayfasına
      } else if (user.email === 'admin@ai.com') {
        router.push('/admin'); // Admin bu sayfayı görmesin
      } else {
        setUserEmail(user.email);
      }
    });

    return () => unsubscribe();
  }, [auth, router]);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'uyeler'), (snapshot) => {
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setMembers(data as any);
    });

    const fetchTasks = async () => {
      const currentUser = auth.currentUser;
      if (!currentUser) return;
      const snapshot = await getDocs(collection(db, `users/${currentUser.uid}/tasks`));
      const data = snapshot.docs.map((doc) => doc.data().title);
      setTasks(data);
    };

    fetchTasks();
    return () => unsubscribe();
  }, []);

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col md:flex-row">
      {/* Sidebar */}
      <aside className="w-full md:w-64 bg-white p-6 shadow-md">
        <h1 className="text-xl font-bold text-black mb-6">AI OFFICE MANAGER</h1>
        <nav className="space-y-4">
          <button
            onClick={() => setSelected('status')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg w-full text-left text-black ${selected === 'status' ? 'bg-gray-200 font-semibold' : 'hover:bg-gray-100'}`}
          >
            <UserCircle className="w-5 h-5" /> Office Status
          </button>
          <button
            onClick={() => setSelected('tasks')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg w-full text-left text-black ${selected === 'tasks' ? 'bg-gray-200 font-semibold' : 'hover:bg-gray-100'}`}
          >
            <CheckSquare className="w-5 h-5" /> My Tasks
          </button>
        </nav>
      </aside>

      {/* Content */}
      <main className="flex-1 p-4 md:p-10 text-black">
        {selected === 'status' && (
          <div>
            <h2 className="text-2xl font-semibold mb-4">Office Status</h2>
            <div className="bg-white rounded-xl p-4 shadow">
              {members.map((member) => (
                <div
                  key={member.id}
                  className="flex justify-between items-center py-2 text-sm border-b last:border-none"
                >
                  <span>{member.name}</span>
                  <span
                    className={`px-3 py-1 rounded-full ${member.isPresent
                      ? 'bg-green-100 text-green-800'
                      : 'bg-gray-100 text-gray-800'
                      }`}
                  >
                    {member.isPresent ? 'Ofiste' : 'Dışarıda'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {selected === 'tasks' && (
          <div>
            <h2 className="text-2xl font-semibold mb-4">My Tasks</h2>
            <div className="bg-white rounded-xl p-4 shadow space-y-2 text-sm">
              {tasks.map((task, i) => (
                <div key={i} className="border-b pb-2 last:border-0 last:pb-0">{task}</div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
