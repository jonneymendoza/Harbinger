import Link from 'next/link';

export default function PublicPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-white dark:bg-slate-950 p-6">
      <div className="max-w-lg text-center">
        <h1 className="text-4xl font-bold text-slate-900 dark:text-slate-100">Harbinger</h1>
        <p className="mt-4 text-lg text-slate-600 dark:text-slate-400">
          Your personalized news aggregation platform. Explore curated content from your favorite gaming and community sources.
        </p>
        <div className="mt-8 flex justify-center gap-4">
          <Link
            href="/login"
            className="px-6 py-3 rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-700 dark:hover:bg-slate-300 transition-colors font-medium"
          >
            Login
          </Link>
        </div>
      </div>
    </main>
  );
}
