import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { EMPTY, catchError, exhaustMap, filter, fromEvent, interval, map, merge } from 'rxjs';
import { fromFetch } from 'rxjs/fetch';

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
    // Every few minutes, and whenever the tab comes back into view.
    merge(
      interval(CHECK_EVERY_MS),
      fromEvent(document, 'visibilitychange').pipe(filter(() => document.visibilityState === 'visible')),
    ).pipe(
      // fetch rather than HttpClient: no token to send, no error toast to show.
      exhaustMap(() => fromFetch('/index.html', { cache: 'no-store', selector: (response) => response.text() }).pipe(
        catchError(() => EMPTY), // offline or mid-deployment: try again at the next check
      )),
      map(mainBundle),
      filter((deployed) => deployed !== null && deployed !== this.running),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(() => this.updateAvailable.set(true));

    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      filter(() => this.updateAvailable()),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(() => this.reload());
  }

  reload(): void {
    location.reload();
  }
}
