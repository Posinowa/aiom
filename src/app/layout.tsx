// app/layout.tsx
import '../globals.css';

export const metadata = {
  title: 'AI Office Manager',
  description: 'Ofis görevlerini yönetin',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body className="min-h-screen bg-gray-100 text-black antialiased">{children}</body>
    </html>
  );
}
