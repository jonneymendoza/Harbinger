'use client';

import { ThemeProvider as NextThemesProvider } from 'next-themes';
import type { ThemeProviderProps } from 'next-themes';
import { AuthProvider } from '@/features/auth/lib/AuthContext';
import { BookmarksProvider } from '@/features/bookmark-feature/lib/BookmarksContext';
import { UpgradePrompt } from '@/features/auth/ui/UpgradePrompt';
import { ToasterProvider } from '@/features/ui/ToasterPosition';
import Navbar from '@/features/ui/Navbar';

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="system">
      <ToasterProvider />
      <AuthProvider>
        {/* Above the router, so bookmark state survives navigation between the
            feed, an article and the bookmarks page. */}
        <BookmarksProvider>
          <UpgradePrompt />
          <div className="min-h-screen flex flex-col">
            <Navbar />
            <main className="flex-1">{children}</main>
          </div>
        </BookmarksProvider>
      </AuthProvider>
    </NextThemesProvider>
  );
}
