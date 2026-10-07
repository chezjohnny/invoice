import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { Component, LOCALE_ID, provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { appConfig } from './app.config';

@Component({
  imports: [CurrencyPipe, DecimalPipe],
  template: `{{ 1250.5 | currency:'CHF':'code':'1.2-2' }} | {{ -12.5 | currency:'CHF':'code':'1.2-2' }} | {{ 8.1 | number:'1.1-1' }}`,
})
class Amounts {}

describe('appConfig locale', () => {
  it('writes amounts the Swiss way: point, apostrophe for thousands', async () => {
    const locale = appConfig.providers.find(
      (p): p is { provide: unknown; useValue: string } => (p as { provide?: unknown }).provide === LOCALE_ID
    );
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), { provide: LOCALE_ID, useValue: locale!.useValue }],
    });
    const fixture = TestBed.createComponent(Amounts);
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toBe('CHF\u00a01’250.50 | CHF-12.50 | 8.1') // a non-breaking space after CHF;
  });
});
