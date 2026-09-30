import { isValidTwintPhone, normalizeTwintPhone } from './twint';

describe('TWINT phone', () => {
  it.each(['079 123 45 67', '+41 79 123 45 67', '0041 79 123 45 67', '079/123.45.67'])(
    'normalises %s to E.164',
    (input) => {
      expect(normalizeTwintPhone(input)).toBe('+41791234567');
      expect(isValidTwintPhone(normalizeTwintPhone(input))).toBe(true);
    }
  );

  it.each(['021 123 45 67', '+33 6 12 34 56 78', '079 123 45 6'])('rejects %s', (input) => {
    expect(isValidTwintPhone(normalizeTwintPhone(input))).toBe(false);
  });
});
