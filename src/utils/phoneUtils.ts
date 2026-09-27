/**
 * Normalize and validate Israeli mobile/landline numbers.
 * Accepts local (05…) and international (+972 / 972) forms.
 */
export function normalizeIsraeliPhone(phoneNumber: string): string {
  const digits = String(phoneNumber).replace(/\D/g, '');
  if (digits.startsWith('972')) return `0${digits.slice(3)}`;
  if (digits.startsWith('00972')) return `0${digits.slice(5)}`;
  return digits;
}

export function isValidIsraeliPhone(phoneNumber: string): boolean {
  if (!phoneNumber?.trim()) return false;
  return /^0\d{8,9}$/.test(normalizeIsraeliPhone(phoneNumber));
}
