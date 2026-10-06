/** Local calendar date as YYYY-MM-DD: toISOString() would shift it to UTC around midnight. */
export function localIsoDate(date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

const DISPLAY_LOCALES = { en: 'en-GB', fr: 'fr-CH' } as const;

/** '2026-10-05' -> '5 oct. 2026' (fr) or '5 Oct 2026' (en): the short natural form shown in the UI. */
export function formatShortDate(isoDate: string, locale: keyof typeof DISPLAY_LOCALES): string {
  return new Intl.DateTimeFormat(DISPLAY_LOCALES[locale], {
    day: 'numeric', month: 'short', year: 'numeric',
  }).format(parseIsoDate(isoDate));
}

/**
 * '2026-10-05' at local midnight. Built from its parts: new Date('2026-10-05')
 * would be UTC midnight, the day before west of Greenwich.
 */
function parseIsoDate(isoDate: string): Date {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/** Whole days from an ISO date to today: 1 the day after. */
export function daysSince(isoDate: string, today = new Date()): number {
  const midnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((midnight.getTime() - parseIsoDate(isoDate).getTime()) / 86_400_000);
}
