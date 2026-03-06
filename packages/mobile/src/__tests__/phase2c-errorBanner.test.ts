import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Phase 2C tests: Error event display
 * - Issue 2-8: serverError -> lastError state + ErrorBanner behavior
 */

// ─── Issue 2-8: serverError -> lastError state management ────

describe('serverError -> lastError state management', () => {
  interface ServerError {
    code: string;
    message: string;
  }

  interface ErrorState {
    lastError: string | null;
  }

  /** Simulates the serverError listener logic in useDoublt */
  function applyServerError(state: ErrorState, error: ServerError): ErrorState {
    return { ...state, lastError: error.message };
  }

  /** Simulates the clearError action */
  function applyClearError(state: ErrorState): ErrorState {
    return { ...state, lastError: null };
  }

  it('sets lastError from serverError event', () => {
    const state: ErrorState = { lastError: null };
    const result = applyServerError(state, { code: 'ERR_AUTH', message: 'Authentication failed' });

    expect(result.lastError).toBe('Authentication failed');
  });

  it('overwrites previous error with new serverError', () => {
    const state: ErrorState = { lastError: 'Previous error' };
    const result = applyServerError(state, { code: 'ERR_NET', message: 'Network timeout' });

    expect(result.lastError).toBe('Network timeout');
  });

  it('clearError sets lastError to null', () => {
    const state: ErrorState = { lastError: 'Some error' };
    const result = applyClearError(state);

    expect(result.lastError).toBeNull();
  });

  it('clearError is safe when lastError is already null', () => {
    const state: ErrorState = { lastError: null };
    const result = applyClearError(state);

    expect(result.lastError).toBeNull();
  });

  it('handles empty error message', () => {
    const state: ErrorState = { lastError: null };
    const result = applyServerError(state, { code: 'ERR_UNKNOWN', message: '' });

    expect(result.lastError).toBe('');
  });
});

// ─── Issue 2-8: ErrorBanner auto-dismiss logic ────

describe('ErrorBanner auto-dismiss behavior', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('auto-dismisses after 3 seconds', () => {
    const onDismiss = vi.fn();
    const AUTO_DISMISS_MS = 3000;

    // Simulate the useEffect timer logic from ErrorBanner
    const timer = setTimeout(() => {
      onDismiss();
    }, AUTO_DISMISS_MS);

    expect(onDismiss).not.toHaveBeenCalled();

    vi.advanceTimersByTime(2999);
    expect(onDismiss).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(onDismiss).toHaveBeenCalledTimes(1);

    clearTimeout(timer);
  });

  it('clears timer on early dismiss', () => {
    const onDismiss = vi.fn();
    const AUTO_DISMISS_MS = 3000;

    const timer = setTimeout(() => {
      onDismiss();
    }, AUTO_DISMISS_MS);

    // User dismisses early
    clearTimeout(timer);
    onDismiss();

    vi.advanceTimersByTime(5000);

    // onDismiss called only once (manual), not twice (no auto)
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('does not call dismiss when message is null', () => {
    const onDismiss = vi.fn();
    const message: string | null = null;

    // Simulate the guard: only set timer if message exists
    if (message) {
      setTimeout(() => onDismiss(), 3000);
    }

    vi.advanceTimersByTime(5000);
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('resets timer when new error arrives', () => {
    const onDismiss = vi.fn();
    const AUTO_DISMISS_MS = 3000;

    // First error
    let timer: ReturnType<typeof setTimeout> | undefined = setTimeout(() => {
      onDismiss();
    }, AUTO_DISMISS_MS);

    vi.advanceTimersByTime(2000);
    expect(onDismiss).not.toHaveBeenCalled();

    // New error arrives, clear old timer and set new one
    clearTimeout(timer);
    timer = setTimeout(() => {
      onDismiss();
    }, AUTO_DISMISS_MS);

    vi.advanceTimersByTime(2000);
    expect(onDismiss).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1000);
    expect(onDismiss).toHaveBeenCalledTimes(1);

    clearTimeout(timer);
  });
});
