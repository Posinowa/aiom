import '../globals.css';
import { Toaster } from 'react-hot-toast';

export const metadata = {
  title: 'AI Office Manager',
  description: 'Ofis görevlerini yönetin',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <head>
        <title>AI Office Manager</title>
        <meta name="description" content="Ofis görevlerini yönetin" />
        <link rel="icon" href="/favicon.ico" type="image/png" />
      </head>
      <body className="min-h-screen bg-gray-100 text-black antialiased">
        {children}

        {/* Geliştirilmiş Toast UI */}
        <Toaster
          position="top-center"
          toastOptions={{
            style: {
              border: '1px solid #1f2937',
              padding: '14px 16px',
              color: '#1f2937',
              background: '#f9fafb',
              fontSize: '14px',
              borderRadius: '12px',
              fontWeight: 500,
            },
            success: {
              iconTheme: {
                primary: '#10b981',
                secondary: '#f0fdf4',
              },
            },
            error: {
              iconTheme: {
                primary: '#ef4444',
                secondary: '#fef2f2',
              },
            },
          }}
        />
      </body>
    </html>
  );
}
