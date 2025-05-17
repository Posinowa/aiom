'use client';

import LoginPage from './admin/components/LoginPage'; // bileşeni components klasörüne taşıdığımızı varsayıyorum

export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <div className="w-full max-w-md">
        <LoginPage />
      </div>
    </main>
  );
}
