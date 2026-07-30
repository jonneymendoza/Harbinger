'use client';

import { Toaster as SonnerToaster } from 'sonner';

/**
 * Renders the global Sonner toast container.
 * Placed in Providers so every page gets toast capability.
 */
export function ToasterProvider() {
  return (
    <SonnerToaster
      position="top-right"
      toastOptions={{
        unstyled: false,
        className:
          'dark:bg-slate-800 dark:border-slate-700 dark:text-white rounded-lg shadow-md',
      }}
      richColors
      closeButton
      expand
    />
  );
}
