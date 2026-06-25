import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from './core/auth/auth.service';
import { I18nService } from './core/i18n/i18n.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    @if (auth.isAuthenticated()) {
      <nav class="navbar bg-base-100 border-b border-base-200 px-4">
        <div class="flex-none">
          <span class="text-lg font-semibold">{{ t().common.app }}</span>
        </div>
        <div class="flex-1 gap-1 ml-4">
          <a routerLink="/dashboard" routerLinkActive="btn-active" class="btn btn-ghost btn-sm">
            {{ t().nav.dashboard }}
          </a>
          <a routerLink="/articles" routerLinkActive="btn-active" class="btn btn-ghost btn-sm">
            {{ t().nav.articles }}
          </a>
          <a routerLink="/customers" routerLinkActive="btn-active" class="btn btn-ghost btn-sm">
            {{ t().nav.customers }}
          </a>
          <a routerLink="/invoices" routerLinkActive="btn-active" class="btn btn-ghost btn-sm">
            {{ t().nav.invoices }}
          </a>
        </div>
        <div class="flex-none gap-2">
          <button class="btn btn-ghost btn-xs font-mono" (click)="i18n.toggle()">
            {{ i18n.locale() === 'en' ? 'FR' : 'EN' }}
          </button>
          <button class="btn btn-ghost btn-sm" (click)="auth.logout()">
            {{ t().nav.signOut }}
          </button>
        </div>
      </nav>
    }
    <router-outlet />
  `,
})
export class App {
  protected readonly auth = inject(AuthService);
  protected readonly i18n = inject(I18nService);
  protected readonly t = this.i18n.T;
}
