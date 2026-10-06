import { WritableSignal } from '@angular/core';

/** Runs `action` unless one is already running: a double click submits once. */
export async function once(busy: WritableSignal<boolean>, action: () => Promise<unknown>): Promise<void> {
  if (busy()) return;
  busy.set(true);
  try {
    await action();
  } finally {
    busy.set(false);
  }
}
