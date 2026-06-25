import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from './core/auth/auth.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    @if (auth.isAuthenticated()) {
      <nav class="navbar bg-base-100 border-b border-base-200 px-4">
        <div class="flex-none">
          <span class="text-lg font-semibold">Invoice</span>
        </div>
        <div class="flex-1 gap-1 ml-4">
          <a routerLink="/articles" routerLinkActive="btn-active" class="btn btn-ghost btn-sm">
            Articles
          </a>
          <a routerLink="/customers" routerLinkActive="btn-active" class="btn btn-ghost btn-sm">
            Customers
          </a>
        </div>
        <div class="flex-none">
          <button class="btn btn-ghost btn-sm" (click)="auth.logout()">Sign out</button>
        </div>
      </nav>
    }
    <router-outlet />
  `,
})
export class App {
  protected readonly auth = inject(AuthService);
}
