import './globals.css';
import { LangProvider } from '@/components/LangContext';

export const metadata = { title: 'Token Bank', description: 'Nicole API Refinery' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <LangProvider>{children}</LangProvider>
      </body>
    </html>
  );
}
