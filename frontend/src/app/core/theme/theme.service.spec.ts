import { TestBed } from '@angular/core/testing';
import { ThemeService } from './theme.service';

describe('ThemeService', () => {
  afterEach(() => {
    localStorage.removeItem('theme');
    document.documentElement.removeAttribute('data-theme');
  });

  it('starts from the theme index.html applied', () => {
    document.documentElement.setAttribute('data-theme', 'dark');
    expect(TestBed.inject(ThemeService).theme()).toBe('dark');
  });

  it('switches the theme and remembers the choice', () => {
    document.documentElement.setAttribute('data-theme', 'light');
    const theme = TestBed.inject(ThemeService);
    theme.toggle();
    expect(theme.theme()).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(localStorage.getItem('theme')).toBe('dark');
    theme.toggle();
    expect(localStorage.getItem('theme')).toBe('light');
  });
});
