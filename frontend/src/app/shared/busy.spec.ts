import { signal } from '@angular/core';
import { once } from './busy';

describe('once', () => {
  it('ignores a second call while the first runs, then allows the next', async () => {
    const busy = signal(false);
    let calls = 0;
    let finish!: () => void;
    const action = () => { calls++; return new Promise<void>((resolve) => (finish = resolve)); };

    const first = once(busy, action);
    await once(busy, action);
    expect(calls).toBe(1);
    expect(busy()).toBe(true);

    finish();
    await first;
    expect(busy()).toBe(false);
    once(busy, action);
    expect(calls).toBe(2);
  });

  it('frees the guard when the action fails', async () => {
    const busy = signal(false);
    await expect(once(busy, () => Promise.reject(new Error('down')))).rejects.toThrow('down');
    expect(busy()).toBe(false);
  });
});
