'use client';

import { Apple as AppleIcon, Facebook } from 'lucide-react';
import { useAuth } from '@/features/auth/lib/AuthContext';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

interface AuthButtonsProps {
  onAuthSuccess?: () => void;
}

function openPopup(provider: string): Window | null {
  const url = `${API_URL}/auth/${provider}`;
  const width = 600;
  const height = 700;
  const left = window.screenX + (window.outerWidth - width) / 2;
  const top = window.screenY + (window.outerHeight - height) / 2;
  return window.open(url, 'oauth', `width=${width},height=${height},left=${left},top=${top}`);
}

function GoogleLogo({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h6.92a5.25 5.25 0 0 1-2.29 3.3v2.23h3.71c2.17-2 3.42-5.33 3.42-8.74Z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.71-2.23c-.98.66-2.23 1.06-3.57 1.06-2.73 0-5.05-1.84-5.89-4.33H2.27v2.31C4.05 20.16 7.74 23 12 23Z" fill="#34A853"/>
      <path d="M6.11 14.84a5.95 5.95 0 0 1 0-3.82V8.71H2.27A10.02 10.02 0 0 0 1 12c0 .98.14 1.92.39 2.79l3.72 2.31Z" fill="#FBBC05"/>
      <path d="M12 5.44c1.63 0 3.1.56 4.25 1.65l3.18-3.18C17.49 1.59 14.99.46 12 .46 7.74.46 4.05 3.3 2.27 7.15l3.84 2.84c.84-2.49 3.16-4.56 5.89-4.56Z" fill="#EA4335"/>
    </svg>
  );
}

export function AuthButtons({ onAuthSuccess }: AuthButtonsProps) {
  const { login } = useAuth();

  const handleOAuth = (provider: string) => {
    const popup = openPopup(provider);
    if (!popup) return;

    window.addEventListener('message', (event: MessageEvent) => {
      if (event.data?.type === 'oauth_success') {
        const { token, user } = event.data.payload;
        login(token, user);
        onAuthSuccess?.();
        popup.close();
      }
      if (event.data?.type === 'oauth_error') {
        alert(event.data.payload?.message || 'Authentication failed');
        popup.close();
      }
    });
  };

  return (
    <div className="flex flex-col gap-3 w-full">
      <button
        onClick={() => handleOAuth('google')}
        className="flex items-center justify-center gap-2 w-full px-4 py-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors font-medium"
      >
        <GoogleLogo size={20} />
        <span>Continue with Google</span>
      </button>

      <button
        onClick={() => handleOAuth('apple')}
        className="flex items-center justify-center gap-2 w-full px-4 py-3 rounded-lg bg-black text-white hover:bg-slate-800 transition-colors font-medium"
      >
        <AppleIcon size={20} fill="currentColor" />
        <span>Continue with Apple</span>
      </button>

      <button
        onClick={() => handleOAuth('facebook')}
        className="flex items-center justify-center gap-2 w-full px-4 py-3 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors font-medium"
      >
        <Facebook size={20} fill="currentColor" />
        <span>Continue with Facebook</span>
      </button>
    </div>
  );
}
