import { daysSince, formatShortDate, localIsoDate } from './dates';

describe('formatShortDate', () => {
  it('shows an ISO date in the short natural form of the language', () => {
    expect(formatShortDate('2026-10-05', 'fr')).toBe('5 oct. 2026');
    expect(formatShortDate('2026-10-05', 'en')).toBe('5 Oct 2026');
  });

  it('keeps the calendar day, whatever the time zone', () => {
    expect(formatShortDate('2026-01-01', 'en')).toBe('1 Jan 2026');
  });
});

describe('localIsoDate', () => {
  it('formats the local calendar date', () => {
    expect(localIsoDate(new Date(2026, 0, 9))).toBe('2026-01-09');
  });
});

describe('daysSince', () => {
  it('counts whole days from a date to today', () => {
    const today = new Date(2026, 9, 5, 23, 30);
    expect(daysSince('2026-10-04', today)).toBe(1);
    expect(daysSince('2026-10-05', today)).toBe(0);
    expect(daysSince('2026-09-05', today)).toBe(30);
  });
});
