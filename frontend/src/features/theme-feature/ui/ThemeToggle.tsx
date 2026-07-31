'use client';

import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { Sun, Moon, Monitor } from 'lucide-react';

type Mode = 'light' | 'dark' | 'system';

const MODES: Mode[] = ['light', 'dark', 'system'];

const ICONS: Record<Mode, typeof Sun> = {
  light: Sun,
  dark: Moon,
  system: Monitor,
};

const LABELS: Record<Mode, string> = {
  light: 'Light',
  dark: 'Dark',
  system: 'System',
};

/**
 * Cycles light → dark → system.
 *
 * `system` is kept as an explicit choice rather than only an initial default,
 * so someone who wants to follow their OS can get back to it after picking a
 * fixed theme.
 */
export function ThemeToggle() {
  const { theme, resolvedTheme, setTheme } = useTheme();

  // next-themes only knows the real theme on the client, so the server render
  // and first paint would disagree. Render a placeholder of the same size until
  // mounted rather than flashing the wrong icon.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <div
        aria-hidden="true"
        className="h-8 w-8 rounded-lg border border-slate-200 dark:border-slate-700"
      />
    );
  }

  const current = (MODES.includes(theme as Mode) ? theme : 'system') as Mode;
  const next = MODES[(MODES.indexOf(current) + 1) % MODES.length];
  const Icon = ICONS[current];

  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      // The button reports what it *is* now; the tooltip says what comes next.
      aria-label={`Theme: ${LABELS[current]}${
        current === 'system' && resolvedTheme ? ` (${resolvedTheme})` : ''
      }. Switch to ${LABELS[next]}.`}
      title={`Theme: ${LABELS[current]} — click for ${LABELS[next]}`}
      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition-colors hover:bg-slate-50 hover:text-indigo-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-indigo-400"
    >
      <Icon size={16} aria-hidden="true" />
    </button>
  );
}
