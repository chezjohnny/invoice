import { computed, inject } from '@angular/core';
import { tapResponse } from '@ngrx/operators';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { exhaustMap, switchMap } from 'rxjs';
import { I18nService } from '../../core/i18n/i18n.service';
import { NotificationService } from '../../core/notifications/notification.service';
import { TENANT_SERVICE } from '../../core/tokens/tenant-service.token';
import { CompanyProfile, CompanyProfileData } from './company.model';

interface CompanyState {
  profile: CompanyProfile | null;
  loading: boolean;
  saving: boolean;
}

const EMPTY: CompanyState = { profile: null, loading: false, saving: false };

// Root-provided: one profile for the shell's warning banner (`isIncomplete`),
// the invoice editor (default VAT rate) and the settings page that edits it.
export const CompanyStore = signalStore(
  { providedIn: 'root' },
  withState<CompanyState>(EMPTY),
  withComputed(({ profile }) => ({
    isIncomplete: computed(() => profile()?.isComplete === false),
  })),
  withMethods((
    store,
    service = inject(TENANT_SERVICE),
    notify = inject(NotificationService),
    i18n = inject(I18nService)
  ) => ({
    load: rxMethod<void>(
      switchMap(() => {
        patchState(store, { loading: true });
        return service.getProfile().pipe(
          tapResponse({
            next: (profile) => patchState(store, { profile }),
            error: () => undefined, // errorInterceptor already surfaced a toast
            finalize: () => patchState(store, { loading: false }),
          }),
        );
      }),
    ),
    // The store is root-provided, so it outlives a session: without this the
    // next tenant to sign in would read (and could overwrite) this profile.
    reset(): void {
      patchState(store, EMPTY);
    },
    /** A second save while one is running is ignored (exhaustMap). */
    save: rxMethod<CompanyProfileData>(
      exhaustMap((data) => {
        patchState(store, { saving: true });
        return service.updateProfile(data).pipe(
          tapResponse({
            next: (profile) => {
              patchState(store, { profile });
              notify.success(i18n.T().settings.saved);
            },
            error: () => undefined, // errorInterceptor already surfaced a toast
            finalize: () => patchState(store, { saving: false }),
          }),
        );
      }),
    ),
  }))
);
