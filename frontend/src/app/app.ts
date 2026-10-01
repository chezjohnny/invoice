import { Component, effect, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from './core/auth/auth.service';
import { I18nService } from './core/i18n/i18n.service';
import { CompanyStore } from './features/settings/company.store';
import { Toasts } from './shared/toasts';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Toasts],
  template: `
    @if (auth.isAuthenticated()) {
      <div class="drawer lg:drawer-open">
        <input id="main-drawer" type="checkbox" class="drawer-toggle" />

        <!-- ── Main content ── -->
        <div class="drawer-content flex flex-col min-h-screen bg-base-200">
          <!-- Mobile top bar (hidden on lg+) -->
          <header class="navbar bg-base-100 border-b border-base-300 lg:hidden sticky top-0 z-30 px-2 min-h-12">
            <label for="main-drawer" class="btn btn-ghost btn-square btn-sm" aria-label="Menu">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </label>
            <span class="ml-2 font-semibold text-sm">{{ t().common.app }}</span>
          </header>
          <main class="flex-1">
            @if (company.isIncomplete()) {
              <div class="px-4 pt-4 md:px-6 md:pt-6">
                <div role="alert" class="alert alert-warning">
                  <svg class="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01M5.07 19h13.86c1.54 0 2.5-1.67 1.73-3L13.73 4a2 2 0 00-3.46 0L3.34 16c-.77 1.33.19 3 1.73 3z" />
                  </svg>
                  <span>{{ t().settings.incompleteBanner }}</span>
                  <a routerLink="/settings" class="btn btn-sm">{{ t().settings.completeProfile }}</a>
                </div>
              </div>
            }
            <router-outlet />
          </main>
        </div>

        <!-- ── Sidebar ── -->
        <div class="drawer-side z-40">
          <label for="main-drawer" class="drawer-overlay" aria-label="Close menu"></label>
          <aside class="w-56 min-h-screen bg-primary text-primary-content flex flex-col">
            <!-- Logo -->
            <div class="px-5 h-14 flex items-center border-b border-primary-content/10 shrink-0">
              <span class="font-bold text-base tracking-tight">{{ t().common.app }}</span>
            </div>

            <!-- Nav links -->
            <nav class="flex-1 flex flex-col gap-0.5 p-3 pt-4">
              <a routerLink="/dashboard" routerLinkActive="is-active" class="sidebar-link">
                <svg class="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M4 5a1 1 0 011-1h4a1 1 0 011 1v5a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm10 0a1 1 0 011-1h4a1 1 0 011 1v2a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zm10-3a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1h-4a1 1 0 01-1-1v-7z" />
                </svg>
                {{ t().nav.dashboard }}
              </a>
              <a routerLink="/customers" routerLinkActive="is-active" class="sidebar-link">
                <svg class="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                {{ t().nav.customers }}
              </a>
              <a routerLink="/invoices" routerLinkActive="is-active" class="sidebar-link">
                <svg class="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                {{ t().nav.invoices }}
              </a>
              <a routerLink="/articles" routerLinkActive="is-active" class="sidebar-link">
                <svg class="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
                {{ t().nav.articles }}
              </a>
            </nav>

            <!-- Footer controls -->
            <div class="p-3 pb-4 border-t border-primary-content/10 flex flex-col gap-0.5">
              <a routerLink="/settings" routerLinkActive="is-active" class="sidebar-link">
                <svg class="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                {{ t().nav.settings }}
              </a>
              <button class="sidebar-link" (click)="i18n.toggle()">
                <svg class="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
                </svg>
                {{ i18n.locale() === 'en' ? 'Français' : 'English' }}
              </button>
              <button class="sidebar-link" (click)="auth.logout()">
                <svg class="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                {{ t().nav.signOut }}
              </button>
            </div>
          </aside>
        </div>
      </div>
    } @else {
      <router-outlet />
    }
    <app-toasts />
  `,
})
export class App {
  protected readonly auth = inject(AuthService);
  protected readonly i18n = inject(I18nService);
  protected readonly t = this.i18n.T;
  protected readonly company = inject(CompanyStore);

  private wasAuthenticated = false;

  constructor() {
    // Fetch the company profile on sign-in only — a silent token refresh keeps
    // `isAuthenticated` true and must not trigger a reload — and drop it on
    // sign-out so it cannot leak into the next session.
    effect(() => {
      const authenticated = this.auth.isAuthenticated();
      if (authenticated && !this.wasAuthenticated) this.company.load();
      if (!authenticated && this.wasAuthenticated) this.company.reset();
      this.wasAuthenticated = authenticated;
    });
  }
}
