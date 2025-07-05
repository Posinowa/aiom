'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { sendEmailVerification } from 'firebase/auth';
import toast from 'react-hot-toast'; // TOAST BURADA

import {
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  sendPasswordResetEmail,
} from 'firebase/auth';
import { auth, db } from '../../lib/firebase';
import {
  collection,
  getDocs,
  query,
  where,
  setDoc,
  doc,
  serverTimestamp,
} from 'firebase/firestore';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = async () => {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      const q = query(collection(db, 'users'), where('email', '==', user.email));
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        toast.error('Sistemde kayıtlı kullanıcı bulunamadı.');
        return;
      }

      const userData = snapshot.docs[0].data();
      const role = userData.role || 'member';

      if (role === 'member' && !user.emailVerified) {
        await sendEmailVerification(user);
        toast.error('E-posta adresiniz doğrulanmamış. Yeni bir doğrulama e-postası gönderildi.');
        await auth.signOut();
        return;
      }

      await setDoc(doc(db, 'userLogs', `${user.uid}_${Date.now()}`), {
        uid: user.uid,
        email: user.email,
        role,
        loginAt: serverTimestamp(),
        companyID: userData.companyID,
      });

      document.cookie = `role=${role}; path=/`;
      document.cookie = `companyID=${userData.companyID}; path=/`;

      router.push('/member');
    } catch (err) {
      toast.error('Giriş başarısız: ' + (err as Error).message);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      const q = query(collection(db, 'users'), where('email', '==', user.email));
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        toast.error('Sistemde kayıtlı kullanıcı bulunamadı.');
        return;
      }

      const userData = snapshot.docs[0].data();
      const role = userData.role || 'member';

      await setDoc(doc(db, 'userLogs', `${user.uid}_${Date.now()}`), {
        uid: user.uid,
        email: user.email,
        role,
        loginAt: serverTimestamp(),
        companyID: userData.companyID,
      });

      document.cookie = `role=${role}; path=/`;
      document.cookie = `companyID=${userData.companyID}; path=/`;

      router.push('/member');
    } catch (err) {
      toast.error('Google ile giriş başarısız: ' + (err as Error).message);
    }
  };

  const handleResetPassword = async () => {
    if (!email) return toast.error('Lütfen e-posta adresinizi girin.');
    try {
      await sendPasswordResetEmail(auth, email);
      toast.success('Parola sıfırlama bağlantısı e-posta adresinize gönderildi.');
    } catch (err: any) {
      toast.error('Hata: ' + err.message);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center px-4">
      <div className="bg-white rounded-xl shadow-lg p-8 w-full max-w-md">
        <h1 className="text-2xl font-bold text-center text-[#1f1f1f] mb-6">
          AI OFFICE MANAGER
        </h1>

        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          className="w-full mb-4 px-4 py-2 border rounded focus:outline-none bg-white text-black"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          className="w-full mb-2 px-4 py-2 border rounded focus:outline-none bg-white text-black"
        />

        <button
          onClick={handleResetPassword}
          className="text-sm text-left text-gray-500 hover:underline mb-4"
        >
          Forgot password?
        </button>

        <button
          onClick={handleLogin}
          className="w-full py-2 rounded bg-gray-200 text-black font-semibold mb-3 hover:bg-gray-100 transition"
        >
          Log in
        </button>

        <button
          onClick={handleGoogleLogin}
          className="w-full py-2 rounded bg-green-100 text-green-800 font-semibold hover:bg-green-200 transition"
        >
          Sign in with Google
        </button>

        <p className="text-sm text-center text-[#1f1f1f] mt-6">
          Don’t have an account?{' '}
          <span
            onClick={() => router.push('/register')}
            className="font-semibold cursor-pointer hover:underline"
          >
            Sign up
          </span>
        </p>
      </div>
    </div>
  );
}
