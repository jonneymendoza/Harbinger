/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ToasterProvider } from '@/features/ui/ToasterPosition';
import * as toastModule from '@/features/ui/toast';

/* -------------------------------------------------------------------------- */
/*  HELPERS                                                                   */
/* -------------------------------------------------------------------------- */

function renderWithToaster() {
  return render(<ToasterProvider />);
}

/* -------------------------------------------------------------------------- */
/*  UNIT TESTS — helper functions are exported, signatures correct            */
/* -------------------------------------------------------------------------- */
describe('toast helpers — unit', () => {
  afterEach(() => vi.clearAllMocks());

  it.each`
    fnName
    ${'showSuccess'}      
    ${'showError'}        
    ${'showWarning'}      
    ${'showInfo'}         
    ${'startLoading'}     
    ${'dismissToast'}     
  `('$fnName is a named export of type function', ({ fnName }) => {
    const fn = toastModule[fnName as keyof typeof toastModule];
    expect(fn).toBeDefined();
    if (fnName !== 'hasOwnProperty') {
      expect(typeof fn).toBe('function');
    }
  });
});

/* -------------------------------------------------------------------------- */
/*  INTEGRATION — real sonner → DOM                                         */
/* -------------------------------------------------------------------------- */
describe('toasts — integration with ToasterProvider', () => {
  it('shows a success toast message', async () => {
    await renderWithToaster();

    await act(async () => {
      toastModule.showSuccess('Changes saved!');
    });

    // Sonner renders each toast into document.body as [role='status'] elements with the message text
    await waitFor(() => {
      expect(screen.getByText('Changes saved!')).toBeInTheDocument();
    }, { timeout: 5000 });
  
    // Should also have a close button since `closeButton` option is enabled
    expect(screen.queryByRole('button', { name: /Close/i })).toBeInTheDocument();
  });

  it('shows an error toast message', async () => {
    await renderWithToaster();

    await act(async () => {
      toastModule.showError('Could not save!', 'Network is unreachable');
    });

    await waitFor(() => {
      expect(screen.getByText('Could not save!')).toBeInTheDocument();
    }, { timeout: 5000 });
    
    // Close button should be present because `closeButton` option is enabled
    expect(screen.queryByRole('button', { name: /Close/i })).toBeInTheDocument();
  });

  it('shows a warning toast', async () => {
    await renderWithToaster();

    await act(async () => {
      toastModule.showWarning('Deprecated endpoint!');
    });

    await waitFor(() => {
      expect(screen.getByText('Deprecated endpoint!')).toBeInTheDocument();
    }, { timeout: 5000 });
  });

  it('shows an info toast', async () => {
    await renderWithToaster();

    await act(async () => {
      toastModule.showInfo('System updated.');
    });

    await waitFor(() => {
      expect(screen.getByText('System updated.')).toBeInTheDocument();
    }, { timeout: 5000 });
  });

  it('dismissing a loading toast removes it from DOM', async () => {
    let id: string | number;

    await renderWithToaster();

    await act(async () => {
      id = toastModule.startLoading('Syncing...');
    });

    await waitFor(() => {
      expect(screen.getByText('Syncing...')).toBeInTheDocument();
    }, { timeout: 5000 });

    await act(async () => {
      toastModule.dismissToast(id);
    });

    // Give animation time to complete
    await new Promise(r => setTimeout(r, 300));
    expect(screen.queryByText('Syncing...')).not.toBeInTheDocument();
  });
});
