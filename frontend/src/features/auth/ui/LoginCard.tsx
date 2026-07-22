import { AuthButtons } from './AuthButtons';

export function LoginCard() {
  return (
    <div className="max-w-md mx-auto bg-white dark:bg-slate-900 rounded-xl shadow-lg p-8">
      <h1 className="text-2xl font-bold text-center text-slate-900 dark:text-slate-100">Welcome to Harbinger</h1>
      <p className="mt-2 text-center text-slate-600 dark:text-slate-400">Sign in with your account</p>
      <div className="mt-6">
        <AuthButtons />
      </div>
    </div>
  );
}
