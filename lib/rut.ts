const MULTIPLIERS = [2, 3, 4, 5, 6, 7, 2, 3] as const;

export function computeRutCheckDigit(body: string): string {
  let sum = 0;
  const reversed = body.split("").reverse();
  for (let i = 0; i < reversed.length; i++) {
    sum += parseInt(reversed[i], 10) * MULTIPLIERS[i % MULTIPLIERS.length];
  }
  const remainder = 11 - (sum % 11);
  if (remainder === 11) return "0";
  if (remainder === 10) return "K";
  return String(remainder);
}

export function isValidRut(rut: string): boolean {
  const clean = rut.replace(/[^0-9kK]/g, "").toUpperCase();
  if (clean.length < 2) return false;
  const body = clean.slice(0, -1);
  const dv = clean.slice(-1);
  if (!/^\d+$/.test(body)) return false;
  if (body.length < 7 || body.length > 8) return false;
  return computeRutCheckDigit(body) === dv;
}

export function normalizeAndValidateRut(rut: string): string | null {
  const clean = rut.replace(/[^0-9kK]/g, "").toUpperCase();
  if (!isValidRut(clean)) return null;
  return clean;
}
