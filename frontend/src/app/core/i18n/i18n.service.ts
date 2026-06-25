import { Injectable, computed, signal } from '@angular/core';
import { Locale, TRANSLATIONS, Translations } from './translations';

@Injectable({ providedIn: 'root' })
export class I18nService {
  readonly locale = signal<Locale>(
    (localStorage.getItem('locale') as Locale | null) ?? 'en'
  );

  readonly T: import('@angular/core').Signal<Translations> = computed(
    () => TRANSLATIONS[this.locale()]
  );

  toggle(): void {
    const next: Locale = this.locale() === 'en' ? 'fr' : 'en';
    localStorage.setItem('locale', next);
    this.locale.set(next);
  }
}
