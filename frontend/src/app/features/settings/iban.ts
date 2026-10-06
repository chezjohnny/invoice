export function normalizeIban(value: string): string {
  return value.replace(/\s/g, '').toUpperCase();
}

// Mirrors the backend rule: a QR-bill only accepts a CH/LI account (21 chars),
// validated with the ISO 13616 mod-97 checksum.
export function isValidQrBillIban(iban: string): boolean {
  if (!/^(CH|LI)[0-9A-Z]{19}$/.test(iban)) return false;
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  const digits = rearranged.replace(/[A-Z]/g, (c) => String(c.charCodeAt(0) - 55));
  // A 21-char IBAN overflows Number.MAX_SAFE_INTEGER — fold the modulo digit by digit.
  let remainder = 0;
  for (const d of digits) remainder = (remainder * 10 + Number(d)) % 97;
  return remainder === 1;
}
