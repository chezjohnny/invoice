import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, catchError, map, of, tap } from 'rxjs';
import { environment } from '../../../environments/environment';

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

  /** Signs in, then opens the dashboard; fails with the server's error. */
  login(email: string, password: string): Observable<void> {
    // Mock mode runs without a backend: any credentials sign in.
    const tokens = environment.useMock
      ? of({ access_token: 'mock', refresh_token: 'mock' })
      : this.http.post<TokenResponse>('/api/auth/login', { email, password });
    return tokens.pipe(
      tap((resp) => {
        this._storeTokens(resp);
        this.router.navigate(['/dashboard']);
      }),
      map(() => undefined),
    );
  }

  /** New tokens for the stored refresh token: true, or false and signed out. */
  refresh(): Observable<boolean> {
    const refreshToken = localStorage.getItem('refresh_token');
    if (!refreshToken) return of(false);
    return this.http.post<TokenResponse>('/api/auth/refresh', { refresh_token: refreshToken }).pipe(
      tap((resp) => this._storeTokens(resp)),
      map(() => true),
      catchError(() => {
        this.logout();
        return of(false);
      }),
    );
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
