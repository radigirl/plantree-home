export function normalizeIngredientKey(input: string): string {
  let value = input.toLowerCase().trim();

  value = value.replace(/\.(?=\s|$)/g, '');
  value = value.replace(/\.(?=[a-zа-я])/gi, ' ');
  value = value.replace(/(\d+(?:[.,]\d+)?)([a-zа-я]+)/gi, '$1 $2');
  value = value.replace(/\s+/g, ' ').trim();

  return value;
}

export function parseLeadingNumberIngredient(
  ingredient: string
): { amount: number; suffix: string } | null {
  const trimmed = ingredient.trim();
  const match = trimmed.match(/^(\d+(?:[.,]\d+)?)\s+(.+)$/);

  if (!match) return null;

  const rawAmount = match[1].replace(',', '.');
  const amount = Number(rawAmount);
  const suffix = match[2].trim();

  if (!Number.isFinite(amount) || !suffix) return null;

  return { amount, suffix };
}

export function parseCountedPlainIngredient(
  ingredient: string
): { count: number; text: string } | null {
  const trimmed = ingredient.trim();
  const match = trimmed.match(/^(\d+)\s*×\s+(.+)$/);

  if (!match) return null;

  const count = Number(match[1]);
  const text = match[2].trim();

  if (!Number.isFinite(count) || !text) return null;

  return { count, text };
}
