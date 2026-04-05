function normalizeIngredientBase(value: string): string {
  const word = value.trim().toLowerCase();

  if (!word) return '';

  // --- BULGARIAN  ---
  // remove common endings
  const bg = word.replace(/(а|я|и|е|о|та|то|те)$/u, '');

  // --- ENGLISH ---
  // berries -> berry
  if (bg.endsWith('ies') && bg.length > 3) {
    return bg.slice(0, -3) + 'y';
  }

  // tomatoes -> tomato, potatoes -> potato
  if (bg.endsWith('es') && bg.length > 3) {
    return bg.slice(0, -2);
  }

  // eggs -> egg
  if (bg.endsWith('s') && bg.length > 2) {
    return bg.slice(0, -1);
  }

  return bg;
}

export function isIngredientMatch(a: string, b: string): boolean {
  const left = a.trim().toLowerCase();
  const right = b.trim().toLowerCase();

  if (!left || !right) return false;

  // exact match first (fast + safe)
  if (left === right) return true;

  // fallback to base match
  return normalizeIngredientBase(left) === normalizeIngredientBase(right);
}