'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createUserWithEmailAndPassword, updateProfile, sendEmailVerification } from 'firebase/auth';
import { auth } from '../../lib/firebase';
import { User, Mail, Lock } from 'lucide-react';

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleRegister = async () => {
    if (password !== confirmPassword) {
      alert('Parolalar eşleşmiyor.');
      return;
    }

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      await updateProfile(user, {
        displayName: displayName,
      });

      await sendEmailVerification(user);
      await auth.signOut();

      alert('Kayıt başarılı! E-posta doğrulama bağlantısı gönderildi. Lütfen e-postanızı onaylayın.');
      router.push('/');
    } catch (error) {
      alert('Kayıt başarısız: ' + (error as Error).message);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center px-4 sm:px-0">
      <div className="bg-white rounded-xl shadow-lg p-6 sm:p-10 w-full max-w-md">
        <h1 className="text-2xl font-bold text-center text-[#1f1f1f] mb-8">
          AI OFFICE MANAGER
        </h1>

        <div className="mb-4 relative">
          <User className="absolute left-3 top-3 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Full Name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded focus:outline-none bg-white text-black"
          />
        </div>

        <div className="mb-4 relative">
          <Mail className="absolute left-3 top-3 text-gray-400 w-5 h-5" />
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded focus:outline-none bg-white text-black"
          />
        </div>

        <div className="mb-4 relative">
          <Lock className="absolute left-3 top-3 text-gray-400 w-5 h-5" />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded focus:outline-none bg-white text-black"
          />
        </div>

        <div className="mb-6 relative">
          <Lock className="absolute left-3 top-3 text-gray-400 w-5 h-5" />
          <input
            type="password"
            placeholder="Confirm Password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded focus:outline-none bg-white text-black"
          />
        </div>

        <button
          onClick={handleRegister}
          className="w-full py-2 rounded bg-gray-200 text-black font-semibold mb-4 hover:bg-gray-100 transition"
        >
          Sign up
        </button>

        <p className="text-sm text-center text-[#1f1f1f]">
          Already have an account?{' '}
          <span
            onClick={() => router.push('/')}
            className="font-semibold cursor-pointer hover:underline"
          >
            Log in
          </span>
        </p>
      </div>
    </div>
  );
}
