import { Component, inject, signal } from '@angular/core';
import { AuthService } from '../../core/auth/auth.service';
import { I18nService } from '../../core/i18n/i18n.service';

@Component({
  selector: 'app-login',
  template: `
    <div class="min-h-screen flex items-center justify-center bg-base-200">
      <div class="card w-96 bg-base-100 shadow-xl">
        <div class="card-body">
          <h2 class="card-title text-2xl justify-center">{{ t().common.app }}</h2>
          <p class="text-center text-base-content/60 mb-4">{{ t().login.subtitle }}</p>
          @if (error()) {
            <div class="alert alert-error text-sm">{{ error() }}</div>
          }
          <form class="flex flex-col gap-4" (submit)="$event.preventDefault(); submit()">
            <label class="floating-label">
              <input
                type="email"
                [placeholder]="t().login.email"
                class="input input-bordered w-full"
                [value]="email()"
                (input)="email.set($any($event.target).value)"
                autocomplete="email"
              />
              <span>{{ t().login.email }}</span>
            </label>
            <label class="floating-label">
              <input
                type="password"
                [placeholder]="t().login.password"
                class="input input-bordered w-full"
                [value]="password()"
                (input)="password.set($any($event.target).value)"
                autocomplete="current-password"
              />
              <span>{{ t().login.password }}</span>
            </label>
            <button type="submit" class="btn btn-primary w-full" [disabled]="loading()">
              @if (loading()) {
                <span class="loading loading-spinner loading-sm"></span>
              }
              {{ t().login.signIn }}
            </button>
          </form>
        </div>
      </div>
    </div>
  `,
})
export class LoginComponent {
  private readonly auth = inject(AuthService);

  protected readonly t = inject(I18nService).T;
  protected readonly email = signal('');
  protected readonly password = signal('');
  protected readonly loading = signal(false);
  protected readonly error = signal('');

  async submit(): Promise<void> {
    this.error.set('');
    this.loading.set(true);
    try {
      await this.auth.login(this.email(), this.password());
    } catch {
      this.error.set(this.t().login.invalid);
    } finally {
      this.loading.set(false);
    }
  }
}
