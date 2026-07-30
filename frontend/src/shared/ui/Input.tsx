import { ComponentPropsWithoutRef, forwardRef, useId } from 'react';

export interface InputProps extends ComponentPropsWithoutRef<'input'> {
  label?: string;
  /** Shown below the field; replaced by `error` when one is present. */
  hint?: string;
  error?: string;
}

const baseClasses =
  'w-full rounded-lg border px-3 py-2 text-sm transition-colors ' +
  'bg-white text-slate-900 placeholder:text-slate-400 ' +
  'dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500 ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 ' +
  'focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-950 ' +
  'disabled:cursor-not-allowed disabled:opacity-60';

const validClasses =
  'border-slate-200 dark:border-slate-700 focus-visible:ring-indigo-500/60 ' +
  'focus-visible:border-indigo-400 dark:focus-visible:border-indigo-500';

const errorClasses = 'border-red-400 dark:border-red-500 focus-visible:ring-red-500/60';

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className = '', label, hint, error, id, ...props }, ref) => {
    const generatedId = useId();
    const inputId = id ?? generatedId;
    const messageId = `${inputId}-message`;
    const message = error ?? hint;

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300"
          >
            {label}
            {props.required && <span className="ml-0.5 text-red-500">*</span>}
          </label>
        )}

        <input
          ref={ref}
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={message ? messageId : undefined}
          className={`${baseClasses} ${error ? errorClasses : validClasses} ${className}`}
          {...props}
        />

        {message && (
          <p
            id={messageId}
            // Announce validation failures; plain hints are not urgent.
            role={error ? 'alert' : undefined}
            className={`mt-1.5 text-xs ${
              error ? 'text-red-600 dark:text-red-400' : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            {message}
          </p>
        )}
      </div>
    );
  },
);

Input.displayName = 'Input';
