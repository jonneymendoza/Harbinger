'use client';

import { useAuth } from '@/features/auth/lib/AuthContext';
import { AuthButtons } from './AuthButtons';
import { CredentialLoginForm } from './CredentialLoginForm';
import { UserMinus } from 'lucide-react';

export function LoginCard() {
  const { setGuestToken } = useAuth();

  const handleGuest = async () => {
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/auth/guest`,
        { method: 'POST' },
      );
      const { data } = await res.json();
      if (data?.token) setGuestToken(data.token);
    } catch {
      // Silently fail — user can retry
    }
  };

  return (
    <div className="max-w-md mx-auto bg-white dark:bg-slate-900 rounded-xl shadow-lg p-8">
      <h1 className="text-2xl font-bold text-center text-slate-900 dark:text-slate-100">Welcome to Harbinger</h1>
      <p className="mt-2 text-center text-slate-600 dark:text-slate-400">Sign in with your account or continue browsing as a guest.</p>
      <div className="mt-6">
        <AuthButtons />
      </div>
      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-slate-200 dark:border-slate-700" />
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-3 bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400">or</span>
        </div>
      </div>
      <button
        onClick={handleGuest}
        className="flex items-center justify-center gap-2 w-full px-4 py-3 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 font-medium transition-colors"
      >
        <UserMinus size={20} />
        <span>Continue as Guest</span>
      </button>

      <div className="mt-6 border-t border-slate-200 pt-5 dark:border-slate-700">
        <CredentialLoginForm />
      </div>
    </div>
  );
}
