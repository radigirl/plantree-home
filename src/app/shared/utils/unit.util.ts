// unit.util.ts
export type NormalizedUnit = 'g' | 'kg' | 'ml' | 'l' | null;
export type BaseUnit = 'g' | 'ml';

function cleanUnit(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[.,]/g, '')
    .trim();
}

export function normalizeUnit(raw: string): NormalizedUnit {
  const unit = cleanUnit(raw);

  if (
    ['г', 'гр', 'g', 'gram', 'grams', 'грам', 'грама'].includes(unit)
  ) {
    return 'g';
  }

  if (
    ['кг', 'kg', 'kilogram', 'kilograms', 'килограм', 'килограма'].includes(unit)
  ) {
    return 'kg';
  }

  if (
    ['мл', 'ml', 'milliliter', 'milliliters', 'милилитър', 'милилитра'].includes(unit)
  ) {
    return 'ml';
  }

  if (
    ['л', 'l', 'liter', 'liters', 'литър', 'литра'].includes(unit)
  ) {
    return 'l';
  }

  return null;
}

export function getBaseUnit(unit: NormalizedUnit): BaseUnit | null {
  if (unit === 'g' || unit === 'kg') return 'g';
  if (unit === 'ml' || unit === 'l') return 'ml';
  return null;
}

export function convertToBaseUnit(
  amount: number,
  unit: NormalizedUnit
): { amount: number; unit: BaseUnit } | null {
  if (unit === 'g') return { amount, unit: 'g' };
  if (unit === 'kg') return { amount: amount * 1000, unit: 'g' };
  if (unit === 'ml') return { amount, unit: 'ml' };
  if (unit === 'l') return { amount: amount * 1000, unit: 'ml' };

  return null;
}

export function formatAmountForDisplay(
  amount: number,
  unit: string
): { amount: number; unit: string } {
  if (unit === 'g' && amount >= 1000) {
    const kg = amount / 1000;

    return {
      amount: Number(kg.toFixed(2)), // keep precision
      unit: 'kg',
    };
  }

  if (unit === 'ml' && amount >= 1000) {
    const l = amount / 1000;

    return {
      amount: Number(l.toFixed(2)),
      unit: 'l',
    };
  }

  return { amount, unit };
}