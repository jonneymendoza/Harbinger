import { ComponentPropsWithoutRef, forwardRef } from 'react';

export interface CardProps extends ComponentPropsWithoutRef<'div'> {
  hover?: boolean;
}

const baseClasses =
  'rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800 overflow-hidden';

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className = '', hover = false, ...props }, ref) => (
    <div
      ref={ref}
      className={`${baseClasses} ${hover ? 'transition hover:shadow-lg cursor-pointer' : ''} ${className}`}
      {...props}
    />
  ),
);

Card.displayName = 'Card';
