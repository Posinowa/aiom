'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { UserCircle, CheckSquare, ShieldCheck } from 'lucide-react';
import { db } from '../lib/firebase';
import {
  collection,
  getDocs,
  onSnapshot,
  query,
  where,
} from 'firebase/firestore';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import MyTasks from './components/MyTasks';

export default function Dashboard() {
  const [selected, setSelected] = useState<'status' | 'tasks'>('status');
  const [members, setMembers] = useState<{ id: string; name: string; isPresent: boolean }[]>([]);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [companyID, setCompanyID] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const router = useRouter();

  const auth = getAuth();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push('/');
      } else {
        setUserEmail(user.email);

        const q = query(collection(db, 'users'), where('email', '==', user.email));
        const snapshot = await getDocs(q);

        if (!snapshot.empty) {
          const userData = snapshot.docs[0].data();

          if (userData.role === 'superAdmin') {
            router.push('/superadmin');
            return; // superAdmin ise başka bir şeye bakma
          }

          setIsAdmin(userData.role === 'admin');
          setCompanyID(userData.companyID);
        }
      }
    });

    return () => unsubscribe();
  }, [auth, router]);


  useEffect(() => {
    if (!companyID) return;

    const q = query(collection(db, 'users'), where('companyID', '==', companyID));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs
        .map((doc) => ({ id: doc.id, ...doc.data() }))
        .filter((doc: any) =>
          doc.name?.trim() !== "" && doc.email !== "admin@ai.com"
        );

      setMembers(data as any);
    });

    return () => unsubscribe();
  }, [companyID]);

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

          {isAdmin && (
            <button
              onClick={() => router.push('/admin')}
              className="flex items-center gap-2 px-4 py-2 rounded-lg w-full text-left text-blue-600 hover:bg-blue-100 border-t pt-4"
            >
              <ShieldCheck className="w-5 h-5" /> Admin Paneline Git
            </button>
          )}
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

        {selected === 'tasks' && <MyTasks />}
      </main>
    </div>
  );
}
