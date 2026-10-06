import { DestroyRef, Injectable, inject, signal } from '@angular/core';

type Theme = 'light' | 'dark';

const STORAGE_KEY = 'theme';

/**
 * Day or night mode. index.html applies it before the first paint; this keeps
 * it in step: the user's choice once made, else the system's, followed live.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly theme = signal<Theme>(
    document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'
  );

  constructor() {
    // Missing outside a real browser (unit tests): the system is then not followed.
    if (typeof matchMedia !== 'function') return;
    const system = matchMedia('(prefers-color-scheme: dark)');
    const onSystemChange = (event: MediaQueryListEvent) => {
      if (!this.stored()) this.apply(event.matches ? 'dark' : 'light');
    };
    system.addEventListener('change', onSystemChange);
    inject(DestroyRef).onDestroy(() => system.removeEventListener('change', onSystemChange));
  }

  toggle(): void {
    const next: Theme = this.theme() === 'dark' ? 'light' : 'dark';
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Private browsing: the choice lasts until the page is reloaded.
    }
    this.apply(next);
  }

  private apply(theme: Theme): void {
    document.documentElement.setAttribute('data-theme', theme);
    this.theme.set(theme);
  }

  private stored(): string | null {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch {
      return null;
    }
  }
}
