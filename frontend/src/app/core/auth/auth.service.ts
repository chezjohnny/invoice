import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

interface TokenResponse {
  access_token: string;
  refresh_token: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  readonly token = signal<string | null>(localStorage.getItem('access_token'));
  readonly isAuthenticated = computed(() => this.token() !== null);

  async login(email: string, password: string): Promise<void> {
    const resp = await firstValueFrom(
      this.http.post<TokenResponse>('/api/auth/login', { email, password })
    );
    this._storeTokens(resp);
    await this.router.navigate(['/articles']);
  }

  async refresh(): Promise<boolean> {
    const refreshToken = localStorage.getItem('refresh_token');
    if (!refreshToken) return false;
    try {
      const resp = await firstValueFrom(
        this.http.post<TokenResponse>('/api/auth/refresh', { refresh_token: refreshToken })
      );
      this._storeTokens(resp);
      return true;
    } catch {
      this.logout();
      return false;
    }
  }

  logout(): void {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    this.token.set(null);
    this.router.navigate(['/login']);
  }

  private _storeTokens(resp: TokenResponse): void {
    localStorage.setItem('access_token', resp.access_token);
    localStorage.setItem('refresh_token', resp.refresh_token);
    this.token.set(resp.access_token);
  }
}
