/**
 * Limits concurrent executions to a maximum number of simultaneous operations.
 *
 * Implemented as a counting semaphore: every caller acquires a slot before
 * running and releases it afterwards, so a queued task holds a slot for its
 * whole lifetime rather than running unaccounted.
 */
export class Throttler {
  private maxConcurrent: number;
  private running: number = 0;
  private queue: Array<() => void> = [];

  constructor(maxConcurrent: number = 3) {
    this.maxConcurrent = Math.max(1, maxConcurrent);
  }

  /**
   * Execute a function with concurrency control.
   * Returns a promise that resolves when the function completes.
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await fn();
    } finally {
      this.release();
    }
  }

  /** Number of tasks currently holding a slot. */
  get activeCount(): number {
    return this.running;
  }

  /** Number of tasks waiting for a slot. */
  get pendingCount(): number {
    return this.queue.length;
  }

  private acquire(): Promise<void> {
    if (this.running < this.maxConcurrent) {
      this.running++;
      return Promise.resolve();
    }

    return new Promise<void>((resolve) => {
      this.queue.push(() => {
        this.running++;
        resolve();
      });
    });
  }

  private release(): void {
    this.running--;
    const next = this.queue.shift();
    if (next) next();
  }
}
