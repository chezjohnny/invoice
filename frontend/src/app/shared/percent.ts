// Rates are 4-decimal fractions (Numeric(5, 4) in the database): a percent has
// 2 decimals at most. Rounding there keeps float noise out (0.037 * 100 is
// 3.6999999999999997).

/** 0.081 → "8.1"; none → "". */
export function percentFromRate(rate: number | null | undefined): string {
  return rate == null ? '' : String(Math.round(rate * 1e6) / 1e4);
}

/** "8.1" → 0.081; "" → null. Check it with isPercent() first. */
export function rateFromPercent(percent: string): number | null {
  return percent.trim() === '' ? null : Math.round(parseFloat(percent) * 100) / 1e4;
}

/** Empty, or a number from 0 to 100. */
export function isPercent(percent: string): boolean {
  if (percent.trim() === '') return true;
  const value = Number(percent);
  return Number.isFinite(value) && value >= 0 && value <= 100;
}
