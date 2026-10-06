import { Location } from '@angular/common';
import { inject } from '@angular/core';
import { Router } from '@angular/router';

/**
 * How a form page is left (cancel, back, save), so that the phone's back button
 * and the page's buttons agree. Call it in an injection context.
 *
 * Opened from another page of the app, leaving goes back in the history rather
 * than stacking a second copy of that page. Opened from a bookmark or a reload,
 * it goes to `fallback()` instead, replacing the form so back cannot reopen it.
 */
export function injectEditorExit(fallback: () => string): () => void {
  const router = inject(Router);
  const location = inject(Location);
  const openedInApp = router.currentNavigation()?.previousNavigation != null;
  return () => {
    if (openedInApp) location.back();
    else router.navigateByUrl(fallback(), { replaceUrl: true });
  };
}
