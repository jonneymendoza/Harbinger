'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button, Input } from '@/shared/ui';
import { useAuth } from '@/features/auth/lib/AuthContext';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8082/api';

/**
 * Email/password sign-in against POST /api/auth/login.
 *
 * This is how an administrator gets in: the bootstrap admin
 * (`ADMIN_USER`/`ADMIN_PASS`) has no OAuth identity, so the social buttons can
 * never reach it. Collapsed by default to keep the social flow primary.
 */
export function CredentialLoginForm() {
  const router = useRouter();
  const { login } = useAuth();

  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !password) {
      setError('Enter both an email and a password.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const json = await res.json();

      if (!res.ok || !json?.success) {
        // The API deliberately does not distinguish unknown account from wrong
        // password; surface its message as-is rather than guessing.
        setError(json?.error?.message || 'Sign in failed.');
        return;
      }

      const { token, user } = json.data;
      login(token, { id: user.id, email: user.email, name: user.displayName }, user.role);
      router.push(user.role === 'ADMIN' ? '/admin' : '/');
    } catch {
      setError('Could not reach the server. Is the backend running?');
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full text-center text-sm text-slate-500 underline-offset-4 transition-colors hover:text-indigo-600 hover:underline dark:text-slate-400 dark:hover:text-indigo-400"
      >
        Sign in with email and password
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 text-left">
      <Input
        label="Email"
        type="email"
        autoComplete="username"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="admin@example.com"
        required
      />
      <Input
        label="Password"
        type="password"
        autoComplete="current-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />

      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      <div className="flex gap-2 pt-1">
        <Button type="submit" disabled={submitting} className="flex-1">
          {submitting ? 'Signing in…' : 'Sign in'}
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            setOpen(false);
            setError(null);
          }}
          disabled={submitting}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
