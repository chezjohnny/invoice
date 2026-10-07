import { percentOf, rateOf } from './percent';

describe('percent', () => {
  it('shows a rate without float noise', () => {
    expect(percentOf(0.037)).toBe(3.7);
    expect(percentOf(0.081)).toBe(8.1);
    expect(percentOf(null)).toBeNull();
  });

  it('reads a percent back as a 4-decimal rate', () => {
    expect(rateOf(3.7)).toBe(0.037);
    expect(rateOf(8.1)).toBe(0.081);
    expect(rateOf(null)).toBeNull();
  });
});
