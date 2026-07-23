'use client';

import { User, LogOut } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/features/auth/lib/AuthContext';

export default function Navbar() {
  const { status, isGuest, triggerUpgradePrompt, logout } = useAuth();

  return (
    <nav className="sticky top-0 z-40 border-b border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-950/90 backdrop-blur">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="text-lg font-bold text-slate-900 dark:text-white">
          Harbinger
        </Link>

        {/* Auth indicator */}
        <div className="flex items-center gap-3">
          {status === 'IS_GUEST' && (
            <>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-800">
                <User className="text-indigo-600 dark:text-indigo-400" size={16} />
                <span className="text-sm font-medium text-indigo-700 dark:text-indigo-300">Guest</span>
              </div>
              <button
                onClick={triggerUpgradePrompt}
                className="px-3 py-1.5 text-sm font-medium rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:from-indigo-700 hover:to-purple-700 transition-all"
              >
                Upgrade
              </button>
            </>
          )}

          {status === 'IS_ANONYMOUS' && (
            <Link
              href="/login"
              className="px-3 py-1.5 text-sm font-medium rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-700 dark:hover:bg-slate-200 transition-colors"
            >
              Login
            </Link>
          )}

          {status !== 'IS_ANONYMOUS' && status !== 'IS_GUEST' && (
            <button
              onClick={logout}
              className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              title="Logout"
            >
              <LogOut size={18} />
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}
