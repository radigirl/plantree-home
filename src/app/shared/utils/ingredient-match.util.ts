/**
 * Ingredient matching utility (name-based only)
 *
 * IMPORTANT:
 * This util is intentionally limited to NAME matching.
 * It does NOT parse or compare quantities or units.
 *
 * Future extension plan:
 * - Quantity parsing (e.g. "100g", "2", "250 ml") should be handled in a separate parser.
 * - Sufficiency checks (do we have enough?) should ONLY run when BOTH:
 *    - the recipe ingredient has a parsed quantity
 *    - the pantry item has a parsed quantity
 *
 * Example:
 * - "100g flour" vs "flour" → match (name only)
 * - "100g flour" vs "50g flour" → requires quantity logic (NOT here)
 *
 * Keep responsibilities separated:
 * - This file → normalization + name matching
 * - Parser util → extract quantity/unit
 * - Availability logic → compare amounts
 *  * NOTE:
 * This util is reused across multiple features (cook-from-pantry, pantry move, etc.),
 * so it must stay simple and predictable.
 */
function normalizeText(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, '');
}

function isBulgarian(value: string): boolean {
  return /[а-я]/i.test(value);
}

function normalizeEnglishWord(word: string): string {
  if (word.length <= 3) {
    return word;
  }

  if (word.endsWith('ies') && word.length > 4) {
    return word.slice(0, -3) + 'y';
  }

  if (
    word.endsWith('es') &&
    word.length > 4 &&
    !word.endsWith('ses') &&
    !word.endsWith('xes')
  ) {
    return word.slice(0, -2);
  }

  if (word.endsWith('s') && word.length > 3) {
    return word.slice(0, -1);
  }

  return word;
}

function normalizeBulgarianWord(word: string): string {
  if (word.length <= 4) {
    return word;
  }

  if (word.endsWith('ите') && word.length > 6) {
    return word.slice(0, -3);
  }

  if (word.endsWith('та') && word.length > 5) {
    return word.slice(0, -2);
  }

  if (word.endsWith('то') && word.length > 5) {
    return word.slice(0, -2);
  }

  if (word.endsWith('те') && word.length > 5) {
    return word.slice(0, -2);
  }

  if (word.endsWith('и') && word.length > 5) {
    return word.slice(0, -1);
  }

  if (word.endsWith('а') && word.length > 5) {
    return word.slice(0, -1);
  }

  if (word.endsWith('я') && word.length > 5) {
    return word.slice(0, -1);
  }

  return word;
}

function normalizeWord(word: string): string {
  const clean = normalizeText(word);

  if (!clean) {
    return '';
  }

  return isBulgarian(clean)
    ? normalizeBulgarianWord(clean)
    : normalizeEnglishWord(clean);
}

function tokenizeIngredient(value: string): string[] {
  return normalizeText(value)
    .split(' ')
    .map(normalizeWord)
    .filter(Boolean);
}

function isMeaningfulToken(token: string): boolean {
  return !/\d/.test(token) && token.length > 2;
}

export function isIngredientMatch(a: string, b: string): boolean {
  const leftTokens = tokenizeIngredient(a).filter(isMeaningfulToken);
  const rightTokens = tokenizeIngredient(b).filter(isMeaningfulToken);

  if (!leftTokens.length || !rightTokens.length) {
    return false;
  }

  const leftJoined = leftTokens.join(' ');
  const rightJoined = rightTokens.join(' ');

  if (leftJoined === rightJoined) {
    return true;
  }

  const sharedTokens = leftTokens.filter((leftToken) =>
    rightTokens.includes(leftToken)
  );

  // single vs single → exact match
  if (leftTokens.length === 1 && rightTokens.length === 1) {
    return sharedTokens.length === 1;
  }

  // single vs multi → avoid false positives like "сода за хляб" vs "хляб"
  if (leftTokens.length === 1 || rightTokens.length === 1) {
    return false;
  }

  // multi vs multi → require full overlap of the smaller phrase
  return sharedTokens.length === Math.min(leftTokens.length, rightTokens.length);
}