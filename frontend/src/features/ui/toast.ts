'use client';

import { toast as sonnerToast } from 'sonner';

export type ToastId = string | number;

/** Standard success message: green check. */
export function showSuccess(message: React.ReactNode, description?: string): ToastId {
  return sonnerToast.success(message as string, { description });
}

/** Error message: red cross. Use for API failures, validation errors etc. */
export function showError(message: React.ReactNode, description?: string): ToastId {
  return sonnerToast.error(message as string, { description });
}

/** Warning message: yellow / amber tone. For deprecations, soft alerts. */
export function showWarning(message: React.ReactNode, description?: string): ToastId {
  return sonnerToast.warning(message as string, { description });
}

/** Info message - blue circle. For status updates, progress hints. */
export function showInfo(message: React.ReactNode, description?: string): ToastId {
  return sonnerToast.info(message as string, { description });
}

/** Creates a dismissible loading toast; returns the id so it can be resolved later. */
export function startLoading(content: string): ToastId {
  return sonnerToast.loading(content);
}

/** Dismisses a specific toast by its id. Use after replacing a loading toast with success/error. */
export function dismissToast(id: ToastId): void {
  sonnerToast.dismiss(id);
}

// Re-export for any caller that needs `toast.custom()` directly
export { sonnerToast as toast };
