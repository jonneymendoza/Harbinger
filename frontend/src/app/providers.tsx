'use client';

import { ThemeProvider as NextThemesProvider } from 'next-themes';
import type { ThemeProviderProps } from 'next-themes';
import { AuthProvider } from '@/features/auth/lib/AuthContext';

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="system">
      <AuthProvider>
        {children}
      </AuthProvider>
    </NextThemesProvider>
  );
}
