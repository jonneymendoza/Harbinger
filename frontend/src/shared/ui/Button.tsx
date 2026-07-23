import { ComponentPropsWithoutRef, forwardRef } from 'react';

interface ButtonBaseProps extends ComponentPropsWithoutRef<'button'> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
}

const baseClasses =
  'inline-flex items-center justify-center rounded-lg font-medium transition-colors focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 cursor-pointer';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'bg-slate-900 text-white hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-300 px-4 py-2',
  secondary: 'border border-slate-200 bg-white hover:bg-slate-50 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700 px-4 py-2',
  ghost: 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 px-3 py-2',
  danger: 'bg-red-600 text-white hover:bg-red-700 px-4 py-2',
};

export const Button = forwardRef<HTMLButtonElement, ButtonBaseProps>(
  ({ className = '', variant = 'primary', ...props }, ref) => (
    <button
      ref={ref}
      className={`${baseClasses} ${variantClasses[variant]} ${className}`}
      {...props}
    />
  ),
);

Button.displayName = 'Button';
