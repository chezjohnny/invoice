// Rates are 4-decimal fractions (Numeric(5, 4) in the database): a percent has
// 2 decimals at most. Rounding there keeps float noise out (0.037 * 100 is
// 3.6999999999999997).

/** 0.081 → 8.1, for a number field; none → null (an empty field). */
export function percentOf(rate: number | null | undefined): number | null {
  return rate == null ? null : Math.round(rate * 1e6) / 1e4;
}

/** 8.1 → 0.081; an empty field → null. */
export function rateOf(percent: number | null): number | null {
  return percent == null ? null : Math.round(percent * 100) / 1e4;
}
