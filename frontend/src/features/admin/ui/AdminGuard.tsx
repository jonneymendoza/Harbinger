'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useAuth } from '@/features/auth/lib/AuthContext';

/**
 * Route wrapper for admin pages (specs/admin-panel.md §2).
 *
 * This is a UX gate, not a security boundary — every admin request is still
 * validated by `checkRole('ADMIN')` server-side. Its job is to avoid rendering
 * a dashboard that would only produce 403s.
 */
export function AdminGuard({ children }: { children: ReactNode }) {
  const { isAuthenticated, isAdmin, role } = useAuth();

  // AuthContext restores from localStorage in an effect, so the first client
  // render always looks anonymous. Showing "denied" during that window would
  // flash a false negative at a signed-in admin.
  const [restored, setRestored] = useState(false);
  useEffect(() => setRestored(true), []);

  if (!restored) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-16">
        <div className="h-8 w-48 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
        <div className="mt-6 h-64 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <Denied
        title="Sign in required"
        message="The admin dashboard needs an administrator account."
        action={{ href: '/login', label: 'Go to sign in' }}
      />
    );
  }

  if (!isAdmin) {
    return (
      <Denied
        title="Administrator access only"
        message={`This area requires the ADMIN role${role ? ` — your account is ${role}` : ''}.`}
        action={{ href: '/', label: 'Back to feed' }}
      />
    );
  }

  return <>{children}</>;
}

function Denied({
  title,
  message,
  action,
}: {
  title: string;
  message: string;
  action: { href: string; label: string };
}) {
  return (
    <div className="mx-auto max-w-md px-4 py-24 text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-500/15">
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          className="text-amber-600 dark:text-amber-400"
          aria-hidden="true"
        >
          <path d="M12 9v4m0 4h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        </svg>
      </div>
      <h1 className="text-xl font-semibold text-slate-900 dark:text-white">{title}</h1>
      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{message}</p>
      <Link
        href={action.href}
        className="mt-6 inline-flex items-center justify-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-300"
      >
        {action.label}
      </Link>
    </div>
  );
}
