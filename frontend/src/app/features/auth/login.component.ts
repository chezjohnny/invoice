import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormField, FormRoot, email, form, required } from '@angular/forms/signals';
import { tapResponse } from '@ngrx/operators';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { exhaustMap } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { I18nService } from '../../core/i18n/i18n.service';
import { AutofocusDirective } from '../../shared/autofocus.directive';
import { FieldErrorComponent } from '../../shared/components/field-error.component';

@Component({
  selector: 'app-login',
  imports: [AutofocusDirective, FieldErrorComponent, FormField, FormRoot],
  template: `
    <div class="min-h-screen flex items-center justify-center bg-base-200 p-4">
      <div class="w-full max-w-sm">
        <!-- Brand header -->
        <div class="bg-primary text-primary-content rounded-t-xl px-8 py-6">
          <h1 class="text-xl font-bold tracking-tight">{{ t().common.app }}</h1>
          <p class="text-primary-content/70 text-sm mt-1">{{ t().login.subtitle }}</p>
        </div>
        <!-- Form card -->
        <div class="card bg-base-100 shadow-lg rounded-t-none">
          <div class="card-body gap-4 pt-6">
            @if (error()) {
              <div class="alert alert-error text-sm py-2" role="alert">{{ error() }}</div>
            }
            <form class="flex flex-col gap-4" [formRoot]="loginForm">
              <label class="floating-label">
                <input
                  type="email"
                  appAutofocus
                  [placeholder]="t().login.email"
                  class="input input-bordered w-full"
                  [formField]="loginForm.email"
                  autocomplete="email"
                />
                <span>{{ t().login.email }}</span>
              </label>
              <app-field-error class="-mt-3" [field]="loginForm.email" />
              <label class="floating-label">
                <input
                  type="password"
                  [placeholder]="t().login.password"
                  class="input input-bordered w-full"
                  [formField]="loginForm.password"
                  autocomplete="current-password"
                />
                <span>{{ t().login.password }}</span>
              </label>
              <app-field-error class="-mt-3" [field]="loginForm.password" />
              <button type="submit" class="btn btn-primary w-full mt-2" [disabled]="loading()">
                @if (loading()) {
                  <span class="loading loading-spinner loading-sm"></span>
                }
                {{ t().login.signIn }}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  `,
})
export class LoginComponent {
  private readonly auth = inject(AuthService);

  protected readonly t = inject(I18nService).T;
  protected readonly loading = signal(false);
  protected readonly error = signal('');

  protected readonly model = signal({ email: '', password: '' });
  protected readonly loginForm = form(
    this.model,
    (path) => {
      required(path.email, { message: () => this.t().login.emailRequired });
      email(path.email, { message: () => this.t().login.emailInvalid });
      required(path.password, { message: () => this.t().login.passwordRequired });
    },
    // Signal Forms takes an async action; the sign-in itself runs in signIn.
    {
      submission: {
        action: async () => {
          this.signIn({ email: this.model().email.trim(), password: this.model().password });
        },
      },
    }
  );

  /** One attempt at a time: a second submit while signing in is ignored (exhaustMap). */
  private readonly signIn = rxMethod<{ email: string; password: string }>(
    exhaustMap(({ email, password }) => {
      this.error.set('');
      this.loading.set(true);
      return this.auth.login(email, password).pipe(
        tapResponse({
          next: () => undefined,
          error: (error) => this.error.set(this.failure(error)),
          finalize: () => this.loading.set(false),
        }),
      );
    }),
  );

  private failure(error: unknown): string {
    const status = error instanceof HttpErrorResponse ? error.status : 0;
    // 429: nginx caps sign-in attempts per address to slow down password guessing.
    if (status === 429) return this.t().login.tooManyAttempts;
    if (status === 0) return this.t().errors.network;
    if (status >= 500) return this.t().errors.server;
    return this.t().login.invalid;
  }
}
