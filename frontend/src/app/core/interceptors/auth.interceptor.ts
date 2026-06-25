import { inject } from '@angular/core';
import { HttpInterceptorFn } from '@angular/common/http';
import { from, throwError } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';
import { AuthService } from '../auth/auth.service';

// Shared across all concurrent requests: only one refresh call in flight at a time.
// Without this, simultaneous 401s each call refresh(), the second arriving with
// an already-revoked token → unexpected logout.
let refreshPromise: Promise<boolean> | null = null;

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const token = auth.token();

  const authReq = token
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  return next(authReq).pipe(
    catchError((error) => {
      if (error.status === 401 && token && !req.url.includes('/auth/')) {
        if (!refreshPromise) {
          refreshPromise = auth.refresh().finally(() => { refreshPromise = null; });
        }
        return from(refreshPromise).pipe(
          switchMap((success) => {
            if (success) {
              const retryReq = req.clone({
                setHeaders: { Authorization: `Bearer ${auth.token()!}` },
              });
              return next(retryReq);
            }
            return throwError(() => error);
          })
        );
      }
      return throwError(() => error);
    })
  );
};
