// Mirrors the backend rule: '079 123 45 67', '0041 79 …' or '+41 79 …'
// all become the E.164 form '+41791234567'.
export function normalizePhone(value: string): string {
  const phone = value.replace(/[\s./()-]/g, '');
  if (phone.startsWith('0041')) return '+41' + phone.slice(4);
  if (phone.startsWith('0')) return '+41' + phone.slice(1);
  return phone;
}

// Any E.164 number: the contact phone may be a landline or a foreign line.
export function isValidPhone(phone: string): boolean {
  return /^\+[1-9]\d{7,14}$/.test(phone);
}

// TWINT accounts are bound to a Swiss mobile number (07x).
export function isValidTwintPhone(phone: string): boolean {
  return /^\+417[5-9]\d{7}$/.test(phone);
}
