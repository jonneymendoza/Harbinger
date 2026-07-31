'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Database, ScrollText, ArrowLeft } from 'lucide-react';

interface NavItem {
  href: string;
  label: string;
  description: string;
  icon: typeof Database;
  /** `/admin` is a prefix of every admin route, so it only matches exactly. */
  exact?: boolean;
}

const NAV: NavItem[] = [
  {
    href: '/admin',
    label: 'Sources',
    description: 'Scraping targets',
    icon: Database,
    exact: true,
  },
  {
    href: '/admin/logs',
    label: 'Scrape logs',
    description: 'Run history',
    icon: ScrollText,
  },
];

function useIsActive() {
  const pathname = usePathname();
  return (item: NavItem) =>
    item.exact ? pathname === item.href : pathname.startsWith(item.href);
}

/**
 * Admin navigation (`specs/admin-panel.md §4`).
 *
 * Rendered twice by AdminShell — a vertical rail from `lg` up, and a horizontal
 * strip below it. A drawer would need open/close state and a focus trap for two
 * links; a strip that is always visible is less to get wrong.
 */
export function AdminSidebar({ orientation }: { orientation: 'vertical' | 'horizontal' }) {
  const isActive = useIsActive();
  const vertical = orientation === 'vertical';

  return (
    <nav
      aria-label="Admin sections"
      className={
        vertical
          ? 'flex flex-col gap-1'
          : 'flex gap-1 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'
      }
    >
      {NAV.map((item) => {
        const active = isActive(item);
        const Icon = item.icon;

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={[
              'group flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60',
              vertical ? '' : 'shrink-0',
              active
                ? 'bg-indigo-50 font-medium text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100',
            ].join(' ')}
          >
            <Icon
              size={16}
              aria-hidden="true"
              className={active ? '' : 'text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300'}
            />
            <span className="flex flex-col">
              <span>{item.label}</span>
              {/* slate-600, not 500: on the active item's indigo-50 tint
                  slate-500 lands at 4.26:1, just under AA. */}
              {vertical && (
                <span className="text-xs text-slate-600 dark:text-slate-400">{item.description}</span>
              )}
            </span>
          </Link>
        );
      })}

      {vertical && (
        <>
          <hr className="my-3 border-slate-200 dark:border-slate-700" />
          <Link
            href="/"
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
          >
            <ArrowLeft size={16} aria-hidden="true" className="text-slate-400" />
            Back to feed
          </Link>
        </>
      )}
    </nav>
  );
}
