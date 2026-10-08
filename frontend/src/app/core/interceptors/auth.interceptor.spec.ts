import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { authInterceptor } from './auth.interceptor';

describe('authInterceptor', () => {
  let http: HttpClient;
  let backend: HttpTestingController;

  beforeEach(() => {
    localStorage.setItem('access_token', 'old-access');
    localStorage.setItem('refresh_token', 'refresh');
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    backend.verify();
    localStorage.clear();
  });

  it('refreshes once for requests failing together, then retries each with the new token', () => {
    const answers: unknown[] = [];
    http.get('/api/articles').subscribe((body) => answers.push(body));
    http.get('/api/customers').subscribe((body) => answers.push(body));
    for (const url of ['/api/articles', '/api/customers']) {
      backend.expectOne(url).flush(null, { status: 401, statusText: 'Unauthorized' });
    }

    // One refresh only: a second one would come with an already-revoked token.
    backend.expectOne('/api/auth/refresh').flush({ access_token: 'new-access', refresh_token: 'new-refresh' });

    for (const url of ['/api/articles', '/api/customers']) {
      const retry = backend.expectOne(url);
      expect(retry.request.headers.get('Authorization')).toBe('Bearer new-access');
      retry.flush({ url });
    }
    expect(answers).toEqual([{ url: '/api/articles' }, { url: '/api/customers' }]);
  });

  it('starts a new refresh for a 401 once the previous one is done', () => {
    http.get('/api/articles').subscribe();
    backend.expectOne('/api/articles').flush(null, { status: 401, statusText: 'Unauthorized' });
    backend.expectOne('/api/auth/refresh').flush({ access_token: 'second', refresh_token: 'r2' });
    backend.expectOne('/api/articles').flush([]);

    http.get('/api/customers').subscribe();
    backend.expectOne('/api/customers').flush(null, { status: 401, statusText: 'Unauthorized' });
    backend.expectOne('/api/auth/refresh').flush({ access_token: 'third', refresh_token: 'r3' });
    expect(backend.expectOne('/api/customers').request.headers.get('Authorization')).toBe('Bearer third');
  });
});
