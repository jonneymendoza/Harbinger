import { AdminGuard } from '@/features/admin/ui/AdminGuard';
import { AdminSidebar } from '@/features/admin/ui/AdminSidebar';

/**
 * Shell for every `/admin/*` route.
 *
 * The guard lives here rather than in each page, so a new admin screen is
 * protected by existing rather than by remembering to wrap itself.
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminGuard>
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="lg:flex lg:gap-8">
          {/* Vertical rail from lg up */}
          <aside className="hidden lg:block lg:w-56 lg:shrink-0">
            <div className="sticky top-20">
              <p className="mb-3 px-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Admin
              </p>
              <AdminSidebar orientation="vertical" />
            </div>
          </aside>

          {/* Horizontal strip below lg */}
          <div className="mb-6 lg:hidden">
            <AdminSidebar orientation="horizontal" />
          </div>

          <div className="min-w-0 flex-1">{children}</div>
        </div>
      </div>
    </AdminGuard>
  );
}
