import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';

const CHECK_EVERY_MS = 5 * 60_000;

/** The content-hashed main bundle an index.html loads, e.g. "main-3XK2QF7A.js". */
export function mainBundle(html: string): string | null {
  return html.match(/src="(main-[\w-]+\.js)"/)?.[1] ?? null;
}

/**
 * Notices a deployment while the app is open. A deployment gives the main
 * bundle a new hashed name in index.html (never cached by nginx), so comparing
 * it with the running one tells an outdated client. The app then reloads at the
 * next navigation, where no form input can be lost, or right away from the banner.
 */
@Injectable({ providedIn: 'root' })
export class AppVersionService {
  readonly updateAvailable = signal(false);

  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  // Unhashed in a development build ("main.js"): no update is ever reported.
  private readonly running = mainBundle(document.documentElement.outerHTML);

  start(): void {
    if (!this.running) return;
    const timer = setInterval(() => this.check(), CHECK_EVERY_MS);
    const onVisible = () => document.visibilityState === 'visible' && this.check();
    document.addEventListener('visibilitychange', onVisible);
    const navigations = this.router.events
      .pipe(filter((e) => e instanceof NavigationEnd))
      .subscribe(() => this.updateAvailable() && this.reload());
    this.destroyRef.onDestroy(() => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
      navigations.unsubscribe();
    });
  }

  reload(): void {
    location.reload();
  }

  private async check(): Promise<void> {
    try {
      const response = await fetch('/index.html', { cache: 'no-store' });
      const deployed = mainBundle(await response.text());
      if (deployed && deployed !== this.running) this.updateAvailable.set(true);
    } catch {
      // Offline or mid-deployment: try again at the next check.
    }
  }
}
