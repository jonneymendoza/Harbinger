import { describe, it, expect } from 'vitest';
import { Throttler } from '../../src/infrastructure/scraper/throttler';

describe('Throttler', () => {
  it('should execute functions immediately when under limit', async () => {
    const throttler = new Throttler(3);
    let executed = 0;

    await Promise.all([
      throttler.execute(async () => { executed++; await new Promise(r => setTimeout(r, 10)); }),
      throttler.execute(async () => { executed++; await new Promise(r => setTimeout(r, 10)); }),
      throttler.execute(async () => { executed++; await new Promise(r => setTimeout(r, 10)); }),
    ]);

    expect(executed).toBe(3);
  });

  it('should limit concurrent executions', async () => {
    const throttler = new Throttler(2);
    let maxConcurrent = 0;
    let current = 0;

    await Promise.all([
      throttler.execute(async () => {
        current++;
        maxConcurrent = Math.max(maxConcurrent, current);
        await new Promise(r => setTimeout(r, 50));
        current--;
      }),
      throttler.execute(async () => {
        current++;
        maxConcurrent = Math.max(maxConcurrent, current);
        await new Promise(r => setTimeout(r, 50));
        current--;
      }),
      throttler.execute(async () => {
        current++;
        maxConcurrent = Math.max(maxConcurrent, current);
        await new Promise(r => setTimeout(r, 50));
        current--;
      }),
    ]);

    expect(maxConcurrent).toBeLessThanOrEqual(2);
  });

  it('should return the result of the executed function', async () => {
    const throttler = new Throttler(1);
    const result = await throttler.execute(async () => {
      await new Promise(r => setTimeout(r, 10));
      return 'success';
    });
    expect(result).toBe('success');
  });

  it('should propagate errors', async () => {
    const throttler = new Throttler(1);
    await expect(
      throttler.execute(async () => {
        throw new Error('test error');
      })
    ).rejects.toThrow('test error');
  });

  it('should queue tasks when at capacity', async () => {
    const throttler = new Throttler(1);
    const order: number[] = [];

    // Start first task (will take 50ms)
    const p1 = throttler.execute(async () => {
      await new Promise(r => setTimeout(r, 50));
      order.push(1);
    });

    // Queue second task
    const p2 = throttler.execute(async () => {
      await new Promise(r => setTimeout(r, 10));
      order.push(2);
    });

    await Promise.all([p1, p2]);
    expect(order).toEqual([1, 2]);
  });

  it('should drain a queue much larger than the concurrency limit', async () => {
    const throttler = new Throttler(3);
    let completed = 0;

    const results = await Promise.all(
      Array.from({ length: 50 }, (_, i) =>
        throttler.execute(async () => {
          await new Promise(r => setTimeout(r, 2));
          completed++;
          return i;
        })
      )
    );

    expect(completed).toBe(50);
    expect(results).toEqual(Array.from({ length: 50 }, (_, i) => i));
    expect(throttler.activeCount).toBe(0);
    expect(throttler.pendingCount).toBe(0);
  });

  it('should never exceed the limit while draining a large queue', async () => {
    const throttler = new Throttler(3);
    let current = 0;
    let peak = 0;

    await Promise.all(
      Array.from({ length: 30 }, () =>
        throttler.execute(async () => {
          current++;
          peak = Math.max(peak, current);
          await new Promise(r => setTimeout(r, 2));
          current--;
        })
      )
    );

    expect(peak).toBeLessThanOrEqual(3);
  });

  it('should release the slot when a queued task rejects', async () => {
    const throttler = new Throttler(1);

    const settled = await Promise.allSettled([
      throttler.execute(async () => { throw new Error('first'); }),
      throttler.execute(async () => { throw new Error('second'); }),
      throttler.execute(async () => 'third'),
    ]);

    expect(settled.map(s => s.status)).toEqual(['rejected', 'rejected', 'fulfilled']);
    expect(throttler.activeCount).toBe(0);
    expect(throttler.pendingCount).toBe(0);
  });
});
