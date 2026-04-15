import {
  normalizeIngredientKey,
  parseLeadingNumberIngredient,
  parseCountedPlainIngredient,
} from './ingredient.util';
import { convertToBaseUnit, formatAmountForDisplay } from './unit.util';
import type { MergeCandidate } from '../components/merge-review-sheet/merge-review-sheet.component';

// -----------------------------
// Merge candidate detection
// -----------------------------

export function detectPossibleMergeCandidatesFromRawIngredients(
  rawIngredients: string[]
): MergeCandidate[] {
  const candidates: MergeCandidate[] = [];

  const normalizedRaw = rawIngredients
    .map((item) => normalizeIngredientKey(item))
    .filter(Boolean);

  for (const itemB of normalizedRaw) {
    const parsedB = parseLeadingNumberIngredient(itemB);

    if (!parsedB || parsedB.amount <= 1 || parsedB.unit) continue;

    const pluralText = parsedB.name.trim().toLowerCase();

    const singularMatches = normalizedRaw.filter((itemA) => {
      if (itemA === itemB) return false;

      const parsedA = parseLeadingNumberIngredient(itemA);
      const isSingularish = !parsedA || (parsedA.amount === 1 && !parsedA.unit);

      if (!isSingularish) return false;

      const singularText = (parsedA ? parsedA.name : itemA).trim().toLowerCase();

      if (singularText === pluralText) return false;

      return areTextsCloseEnough(singularText, pluralText);
    });

    if (singularMatches.length > 0) {
      const singularText = (() => {
        const first = singularMatches[0];
        const parsed = parseLeadingNumberIngredient(first);
        return (parsed ? parsed.name : first).trim().toLowerCase();
      })();

      const exists = candidates.some(
        (c) => c.singularText === singularText && c.pluralText === pluralText
      );

      if (!exists) {
        candidates.push({
          singularItems: singularMatches,
          pluralItem: itemB,
          singularText,
          pluralText,
          similarity: 1,
        });
      }
    }
  }

  return candidates;
}

// -----------------------------
// Text similarity
// -----------------------------

export function areTextsCloseEnough(a: string, b: string): boolean {
  const left = a.trim().toLowerCase();
  const right = b.trim().toLowerCase();

  if (!left || !right || left === right) return false;

  const leftWords = left.split(/\s+/).filter(Boolean);
  const rightWords = right.split(/\s+/).filter(Boolean);

  if (leftWords.length === 1 && rightWords.length === 1) {
    return getWordCloseness(leftWords[0], rightWords[0]) >= 0.55;
  }

  if (leftWords.length !== rightWords.length) return false;

  let strong = 0;
  let weak = 0;
  let total = 0;

  for (let i = 0; i < leftWords.length; i++) {
    const score = getWordCloseness(leftWords[i], rightWords[i]);
    total += score;

    if (score >= 0.55) strong++;
    else if (score >= 0.35) weak++;
    else return false;
  }

  const avg = total / leftWords.length;

  return strong >= leftWords.length - 1 ||
    (strong + weak === leftWords.length && avg >= 0.4);
}

export function getWordCloseness(a: string, b: string): number {
  return Math.max(
    getWordSimilarityScore(a, b),
    getCommonPrefixRatio(a, b)
  );
}

export function getWordSimilarityScore(a: string, b: string): number {
  const left = a.trim().toLowerCase();
  const right = b.trim().toLowerCase();

  if (!left || !right) return 0;
  if (left === right) return 1;

  const leftBigrams = getWordBigrams(left);
  const rightBigrams = getWordBigrams(right);

  if (!leftBigrams.length || !rightBigrams.length) return 0;

  let overlap = 0;
  const pool = [...rightBigrams];

  for (const bigram of leftBigrams) {
    const index = pool.indexOf(bigram);
    if (index !== -1) {
      overlap++;
      pool.splice(index, 1);
    }
  }

  return (2 * overlap) / (leftBigrams.length + rightBigrams.length);
}

export function getCommonPrefixRatio(a: string, b: string): number {
  const left = a.trim().toLowerCase();
  const right = b.trim().toLowerCase();

  if (!left || !right) return 0;
  if (left === right) return 1;

  const min = Math.min(left.length, right.length);
  let same = 0;

  for (let i = 0; i < min; i++) {
    if (left[i] !== right[i]) break;
    same++;
  }

  return same / Math.max(left.length, right.length);
}

export function getWordBigrams(word: string): string[] {
  if (word.length < 2) return [];

  const result: string[] = [];
  for (let i = 0; i < word.length - 1; i++) {
    result.push(word.slice(i, i + 2));
  }
  return result;
}

// -----------------------------
// Merge logic (raw ingredients)
// -----------------------------

export function getMergeableRawIngredientInfo(raw: string) {
  const normalized = normalizeIngredientKey(raw);
  const parsed = parseLeadingNumberIngredient(normalized);

  if (parsed && parsed.unit) return null;

  if (parsed) {
    return {
      kind: parsed.amount > 1 ? 'pluralish' : 'singularish',
      text: parsed.name.trim().toLowerCase(),
      count: parsed.amount,
    };
  }

  return {
    kind: 'singularish',
    text: normalized.trim().toLowerCase(),
    count: 1,
  };
}

export function applySelectedMergesToRawIngredients(
  rawIngredients: string[],
  selectedCandidates: MergeCandidate[]
): string[] {
  let working = [...rawIngredients];

  for (const candidate of selectedCandidates) {
    working = applySingleMergeCandidate(working, candidate);
  }

  return working;
}

export function applySingleMergeCandidate(
  rawIngredients: string[],
  candidate: MergeCandidate
): string[] {
  const kept: string[] = [];
  let total = 0;

  for (const raw of rawIngredients) {
    const info = getMergeableRawIngredientInfo(raw);

    if (!info) {
      kept.push(raw);
      continue;
    }

    const matchSingular =
      info.kind === 'singularish' && info.text === candidate.singularText;

    const matchPlural =
      info.kind === 'pluralish' && info.text === candidate.pluralText;

    if (matchSingular || matchPlural) {
      total += info.count;
    } else {
      kept.push(raw);
    }
  }

  if (total > 0) {
    kept.push(`${total} ${candidate.pluralText}`);
  }

  return kept;
}

// -----------------------------
// Grouping / aggregation
// -----------------------------

export function buildIngredientsFromRawIngredients(rawIngredients: string[]): string[] {
  const grouped = new Map<string, any>();

  for (const ingredient of rawIngredients) {
    const normalized = normalizeIngredientKey(ingredient);
    const parsed = parseLeadingNumberIngredient(normalized);

    let key: string;

    if (parsed && parsed.unit) {
      const converted = convertToBaseUnit(parsed.amount, parsed.unit);
      key = converted
        ? `parsed:${converted.unit}:${parsed.name}`
        : `parsed:${parsed.suffix}`;
    } else if (parsed) {
      key = `parsed:${parsed.suffix}`;
    } else {
      key = `plain:${normalized}`;
    }

    if (!grouped.has(key)) {
      grouped.set(key, {
        originalText: normalized,
        count: 1,
        parsedAmount: parsed?.amount ?? null,
        suffix: parsed?.suffix ?? null,
        isParsed: !!parsed,
      });
      continue;
    }

    const existing = grouped.get(key);
    existing.count += 1;
  }

  const result: string[] = [];

  for (const entry of grouped.values()) {
    if (entry.isParsed && entry.parsedAmount && entry.suffix) {
      result.push(`${entry.parsedAmount} ${entry.suffix}`);
    } else if (entry.count > 1) {
      result.push(`${entry.count} × ${entry.originalText}`);
    } else {
      result.push(entry.originalText);
    }
  }

  return result.sort((a, b) =>
    getIngredientSortKey(a).localeCompare(getIngredientSortKey(b))
  );
}

// -----------------------------
// Sorting
// -----------------------------

export function getIngredientSortKey(input: string): string {
  const normalized = normalizeIngredientKey(input);

  const counted = parseCountedPlainIngredient(normalized);
  if (counted) return simplifyIngredientSortText(counted.text);

  const parsed = parseLeadingNumberIngredient(normalized);
  if (parsed) return simplifyIngredientSortText(parsed.suffix);

  return simplifyIngredientSortText(normalized);
}

export function simplifyIngredientSortText(text: string): string {
  const parts = text.toLowerCase().trim().split(' ').filter(Boolean);
  return parts.length > 1 && parts[0].length <= 2
    ? parts.slice(1).join(' ')
    : parts.join(' ');
}