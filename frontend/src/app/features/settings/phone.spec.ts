import { isValidPhone, isValidTwintPhone, normalizePhone } from './phone';

describe('TWINT phone', () => {
  it.each(['079 123 45 67', '+41 79 123 45 67', '0041 79 123 45 67', '079/123.45.67'])(
    'normalises %s to E.164',
    (input) => {
      expect(normalizePhone(input)).toBe('+41791234567');
      expect(isValidTwintPhone(normalizePhone(input))).toBe(true);
    }
  );

  it.each(['021 123 45 67', '+33 6 12 34 56 78', '079 123 45 6'])('rejects %s', (input) => {
    expect(isValidTwintPhone(normalizePhone(input))).toBe(false);
  });
});

describe('contact phone', () => {
  it.each([
    ['024 123 45 67', '+41241234567'],
    ['+33 1 23 45 67 89', '+33123456789'],
  ])('accepts %s', (input, expected) => {
    expect(normalizePhone(input)).toBe(expected);
    expect(isValidPhone(normalizePhone(input))).toBe(true);
  });

  it('rejects a number too short to be one', () => {
    expect(isValidPhone(normalizePhone('12'))).toBe(false);
  });
});
