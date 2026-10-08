import { inject } from '@angular/core';
import { HttpInterceptorFn } from '@angular/common/http';
import { Observable, catchError, finalize, shareReplay, switchMap, throwError } from 'rxjs';
import { AuthService } from '../auth/auth.service';

// Shared across all concurrent requests: only one refresh call in flight at a time.
// Without this, simultaneous 401s each call refresh(), the second arriving with
// an already-revoked token → unexpected logout. shareReplay hands its answer to
// the requests that fail meanwhile; once it is done, the next 401 starts anew.
let refreshing: Observable<boolean> | null = null;

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const token = auth.token();

  const authReq = token
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  return next(authReq).pipe(
    catchError((error) => {
      if (error.status === 401 && token && !req.url.includes('/auth/')) {
        refreshing ??= auth.refresh().pipe(
          finalize(() => (refreshing = null)),
          shareReplay({ bufferSize: 1, refCount: false }),
        );
        return refreshing.pipe(
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
