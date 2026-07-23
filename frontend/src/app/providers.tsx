'use client';

import { ThemeProvider as NextThemesProvider } from 'next-themes';
import type { ThemeProviderProps } from 'next-themes';
import { AuthProvider } from '@/features/auth/lib/AuthContext';
import { UpgradePrompt } from '@/features/auth/ui/UpgradePrompt';
import Navbar from '@/features/ui/Navbar';

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="system">
      <AuthProvider>
        <UpgradePrompt />
        <div className="min-h-screen flex flex-col">
          <Navbar />
          <main className="flex-1">{children}</main>
        </div>
      </AuthProvider>
    </NextThemesProvider>
  );
}
