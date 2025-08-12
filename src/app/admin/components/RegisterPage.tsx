'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  createUserWithEmailAndPassword,
  updateProfile,
  sendEmailVerification,
} from 'firebase/auth';
import { auth, db } from '../../lib/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { User, Mail, Lock } from 'lucide-react';
import { toast } from 'react-hot-toast';

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [gender, setGender] = useState<'male' | 'female'>('male'); // ✅ varsayılan değer

  const handleRegister = async () => {
    if (password !== confirmPassword) {
      toast.error('Parolalar eşleşmiyor.');
      return;
    }

    if (!email.includes('@') || !email.includes('.')) {
      toast.error('Geçerli bir e-posta adresi giriniz.');
      return;
    }
    if (!displayName.trim()) {
      toast.error('İsim alanı boş bırakılamaz.');
      return;
    }

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      await updateProfile(user, {
        displayName: displayName,
      });

      await setDoc(doc(db, 'users', user.uid), {
        uid: user.uid,
        email,
        name: displayName,
        role: 'member',
        isPresent: true,
        companyID: 'defaultCompany',
        gender, // ✅ gender Firestore'a kaydediliyor
        createdAt: serverTimestamp(),
      });

      await sendEmailVerification(user);
      await auth.signOut();

      toast.success('Kayıt başarılı! E-posta doğrulama bağlantısı gönderildi.');
      router.push('/');
    } catch (error: any) {
      switch (error.code) {
        case 'auth/invalid-email':
          toast.error('Geçersiz e-posta adresi.');
          break;
        case 'auth/email-already-in-use':
          toast.error('Bu e-posta zaten kullanılıyor.');
          break;
        case 'auth/weak-password':
          toast.error('Parola en az 6 karakter olmalıdır.');
          break;
        default:
          toast.error('Hata: ' + error.message);
      }
    }
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const noNumbers = value.replace(/[0-9]/g, '');
    setDisplayName(noNumbers);
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
            onChange={handleNameChange}
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

        <div className="mb-4 relative">
          <Lock className="absolute left-3 top-3 text-gray-400 w-5 h-5" />
          <input
            type="password"
            placeholder="Confirm Password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded focus:outline-none bg-white text-black"
          />
        </div>

        {/* ✅ Gender seçimi alanı */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-1">Cinsiyet</label>
          <select
            value={gender}
            onChange={(e) => setGender(e.target.value as 'male' | 'female')}
            className="w-full border rounded px-3 py-2 bg-white text-black"
          >
            <option value="male">Erkek</option>
            <option value="female">Kadın</option>
          </select>
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
