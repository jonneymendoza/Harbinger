'use client';

import { X, UserPlus } from 'lucide-react';
import { useAuth } from '@/features/auth/lib/AuthContext';

export function UpgradePrompt() {
  const { showUpgradePrompt, dismissUpgradePrompt } = useAuth();

  if (!showUpgradePrompt) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div 
        role="dialog" 
        aria-modal 
        className="w-full max-w-md mx-4 rounded-xl bg-white dark:bg-slate-900 shadow-xl border border-slate-200 dark:border-slate-700 p-6 animate-in fade-in zoom-in duration-200"
      >
        <button
          onClick={dismissUpgradePrompt}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
          aria-label="Dismiss"
        >
          <X size={20} />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center">
            <UserPlus className="text-indigo-600 dark:text-indigo-400" size={20} />
          </div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
            Create an Account
          </h3>
        </div>

        <p className="text-slate-600 dark:text-slate-400 mb-6">
          Save articles by creating an account. You can link your guest session later to keep everything synced.
        </p>

        <div className="flex gap-3">
          <a
            href="/login"
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium transition-colors"
          >
            Sign Up
          </a>
          <button
            onClick={dismissUpgradePrompt}
            className="flex-1 px-4 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 font-medium transition-colors"
          >
            Keep Browsing
          </button>
        </div>
      </div>
    </div>
  );
}
