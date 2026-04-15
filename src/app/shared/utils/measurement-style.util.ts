export type NormalizedMeasurementStyle =
  | 'cup'
  | 'tbsp'
  | 'tsp'
  | null;

export interface ParsedMeasurementStyleIngredient {
  count: number;
  style: Exclude<NormalizedMeasurementStyle, null>;
  ingredient: string;
  normalizedText: string;
}

function cleanMeasurementToken(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .replace(/\.(?=\s|$)/g, '')
    .replace(/\./g, '');
}

export function normalizeMeasurementStyle(
  raw: string
): NormalizedMeasurementStyle {
  const token = cleanMeasurementToken(raw);

  if (
    [
      'cup',
      'cups',
      'чаша',
      'чаши',
      'чч',
      'ч ч',
    ].includes(token)
  ) {
    return 'cup';
  }

  if (
    [
      'tbsp',
      'tablespoon',
      'tablespoons',
      'сл',
      'с л',
      'с.л',
      'с. л',
      'супена лъжица',
      'супени лъжици',
    ].includes(token)
  ) {
    return 'tbsp';
  }

  if (
    [
      'tsp',
      'teaspoon',
      'teaspoons',
      'чл',
      'ч л',
      'ч.л',
      'ч. л',
      'чаена лъжичка',
      'чаени лъжички',
    ].includes(token)
  ) {
    return 'tsp';
  }

  return null;
}

function splitMeasurementPhrase(input: string): string[] {
  return input
    .toLowerCase()
    .trim()
    .replace(/\.(?=\s|$)/g, '')
    .replace(/\.(?=[a-zа-я])/gi, ' ')
    .replace(/\s+/g, ' ')
    .split(' ')
    .filter(Boolean);
}

export function parseMeasurementStyleIngredient(
  input: string
): ParsedMeasurementStyleIngredient | null {
  const parts = splitMeasurementPhrase(input);

  if (!parts.length) {
    return null;
  }

  let count = 1;
  let style: NormalizedMeasurementStyle = null;
  let ingredientStartIndex = 0;

  const firstAsNumber = Number(parts[0].replace(',', '.'));
  const hasLeadingNumber = Number.isFinite(firstAsNumber);

  if (hasLeadingNumber) {
    count = firstAsNumber;

    // Try 2-word style first, e.g. "ч ч", "ч л", "с л"
    if (parts.length >= 4) {
      const twoWordStyle = normalizeMeasurementStyle(`${parts[1]} ${parts[2]}`);
      if (twoWordStyle) {
        style = twoWordStyle;
        ingredientStartIndex = 3;
      }
    }

    // Fallback: 1-word style, e.g. "чаша", "cups"
    if (!style && parts.length >= 3) {
      const oneWordStyle = normalizeMeasurementStyle(parts[1]);
      if (oneWordStyle) {
        style = oneWordStyle;
        ingredientStartIndex = 2;
      }
    }
  } else {
    // No leading number

    // Try 2-word style first
    if (parts.length >= 3) {
      const twoWordStyle = normalizeMeasurementStyle(`${parts[0]} ${parts[1]}`);
      if (twoWordStyle) {
        style = twoWordStyle;
        ingredientStartIndex = 2;
      }
    }

    // Fallback: 1-word style
    if (!style && parts.length >= 2) {
      const oneWordStyle = normalizeMeasurementStyle(parts[0]);
      if (oneWordStyle) {
        style = oneWordStyle;
        ingredientStartIndex = 1;
      }
    }
  }

  const ingredient = parts.slice(ingredientStartIndex).join(' ').trim();

  if (!style || !ingredient) {
    return null;
  }

  return {
    count,
    style,
    ingredient,
    normalizedText: `${count} ${style} ${ingredient}`.trim(),
  };
}

export function isMeasurementStyleIngredient(input: string): boolean {
  return !!parseMeasurementStyleIngredient(input);
}