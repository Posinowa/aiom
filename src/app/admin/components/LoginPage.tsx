// Güncellenmiş login sayfası - mobil uyumlu (responsive)

'use client';

import { useRouter } from 'next/navigation';
import {
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  sendPasswordResetEmail,
} from 'firebase/auth';
import { auth, db } from '../../lib/firebase';
import { useState } from 'react';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = async () => {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      const role = user.email === 'admin@ai.com' ? 'admin' : 'member';

      if (role === 'member' && !user.emailVerified) {
        alert('Lütfen e-posta adresinizi doğrulayın.');
        return;
      }

      await setDoc(doc(db, 'userLogins', user.uid), {
        name: user.displayName || '',
        email: user.email,
        role,
        lastLogin: serverTimestamp(),
      });

      document.cookie = `role=${role}; path=/`;
      router.push(role === 'admin' ? '/admin' : '/member');
    } catch (err) {
      const error = err as Error;
      alert('Giriş başarısız: ' + error.message);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      const role = user.email === 'admin@ai.com' ? 'admin' : 'member';

      document.cookie = `role=${role}; path=/`;
      router.push(role === 'admin' ? '/admin' : '/member');
    } catch (err) {
      const error = err as Error;
      alert('Google ile giriş başarısız: ' + error.message);
    }
  };

  const handleResetPassword = async () => {
    if (!email) return alert('Lütfen e-posta adresinizi girin.');
    try {
      await sendPasswordResetEmail(auth, email);
      alert('Parola sıfırlama bağlantısı e-posta adresinize gönderildi.');
    } catch (err: any) {
      if (err.code === 'auth/user-not-found') {
        alert('Bu e-posta adresi sistemde kayıtlı değil.');
      } else {
        alert('Hata: ' + err.message);
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center px-4">
      <div className="bg-white rounded-xl shadow-lg p-8 w-full max-w-md">
        <h1 className="text-2xl font-bold text-center text-[#1f1f1f] mb-6">
          AI OFFICE MANAGER
        </h1>

        <label className="block text-sm font-semibold mb-1 text-[#1f1f1f]">Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          className="w-full mb-4 px-4 py-2 border rounded focus:outline-none bg-white text-black"
        />

        <label className="block text-sm font-semibold mb-1 text-[#1f1f1f]">Password</label>
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
