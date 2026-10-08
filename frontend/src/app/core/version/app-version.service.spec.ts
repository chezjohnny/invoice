import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AppVersionService, mainBundle } from './app-version.service';

describe('mainBundle', () => {
  it('finds the hashed main bundle of an index.html', () => {
    const html = '<script src="polyfills-AB12.js" type="module"></script><script src="main-3XK2QF7A.js" type="module"></script>';
    expect(mainBundle(html)).toBe('main-3XK2QF7A.js');
  });

  it('reports none for an unhashed development build', () => {
    expect(mainBundle('<script src="main.js" type="module"></script>')).toBeNull();
  });
});

describe('AppVersionService', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('reports a deployment found at the periodic check, and only a new bundle', async () => {
    vi.useFakeTimers();
    document.documentElement.innerHTML = '<head><script src="main-OLD1.js"></script></head>';
    let deployed = 'main-OLD1.js';
    vi.stubGlobal('fetch', async () => new Response(`<script src="${deployed}"></script>`));
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection(), provideRouter([])] });
    const version = TestBed.inject(AppVersionService);
    version.start();

    await vi.advanceTimersByTimeAsync(5 * 60_000);
    expect(version.updateAvailable()).toBe(false);
    deployed = 'main-NEW2.js';
    await vi.advanceTimersByTimeAsync(5 * 60_000);
    expect(version.updateAvailable()).toBe(true);
  });
});
