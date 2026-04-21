export function parseMixedNumber(value: string): number | null {
  const normalized = value.trim().replace(',', '.');

  // X Y/Z  → mixed number (e.g. 2 1/2)
  const mixed = normalized.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixed) {
    const whole = Number(mixed[1]);
    const num = Number(mixed[2]);
    const den = Number(mixed[3]);

    if (den !== 0) {
      return whole + num / den;
    }
  }

  // Y/Z → fraction (e.g. 1/2)
  const fraction = normalized.match(/^(\d+)\/(\d+)$/);
  if (fraction) {
    const num = Number(fraction[1]);
    const den = Number(fraction[2]);

    if (den !== 0) {
      return num / den;
    }
  }

  // decimal or integer (e.g. 1.5, 2)
  const numeric = Number(normalized);
  return Number.isFinite(numeric) ? numeric : null;
}