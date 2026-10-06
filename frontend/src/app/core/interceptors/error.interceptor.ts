import { inject } from '@angular/core';
import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { I18nService } from '../i18n/i18n.service';
import { Translations } from '../i18n/translations';
import { NotificationService } from '../notifications/notification.service';

// Shows a localized toast for every backend error. Registered as the OUTER
// interceptor (before authInterceptor) so it only fires on the final error —
// a 401 that authInterceptor transparently refreshes + retries never reaches
// here. Auth endpoints handle their own messaging (login page), so we stay
// silent on them.
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const notify = inject(NotificationService);
  const i18n = inject(I18nService);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      if (!req.url.includes('/auth/')) {
        notify.error(messageFor(error, i18n.T().errors));
      }
      return throwError(() => error);
    })
  );
};

function messageFor(error: HttpErrorResponse, t: Translations['errors']): string {
  switch (error.status) {
    case 0:
      return t.network;
    case 400:
      return t.badRequest;
    case 401:
      return t.unauthorized;
    case 403:
      return t.forbidden;
    case 404:
      return t.notFound;
    case 409:
      return t.conflict;
    case 422:
      return t.validation;
    default:
      return error.status >= 500 ? t.server : t.unknown;
  }
}
