import { isPercent, percentFromRate, rateFromPercent } from './percent';

describe('percent', () => {
  it('shows a rate without float noise', () => {
    expect(percentFromRate(0.037)).toBe('3.7');
    expect(percentFromRate(0.081)).toBe('8.1');
    expect(percentFromRate(null)).toBe('');
  });

  it('reads a percent back as a 4-decimal rate', () => {
    expect(rateFromPercent('3.7')).toBe(0.037);
    expect(rateFromPercent('8.1')).toBe(0.081);
    expect(rateFromPercent(' ')).toBeNull();
  });

  it('accepts empty or 0 to 100 only', () => {
    expect(['', '0', '7.7', '100'].every(isPercent)).toBe(true);
    expect(['-1', '100.5', 'abc'].some(isPercent)).toBe(false);
  });
});
