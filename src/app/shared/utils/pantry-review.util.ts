import { isIngredientMatch } from './ingredient-match.util';

export interface PantryReviewCandidate {
  id: string;
  name: string;
  unit?: string | null;
  size_amount?: number | null;
  size_unit?: string | null;
}

export interface PantryReviewItemMatch {
  item: any;
  candidate: PantryReviewCandidate;
}

export interface PantryReviewItemWithCandidates {
  item: any;
  candidates: PantryReviewCandidate[];
}

export interface PantryReviewResult {
  newItems: any[];
  exactMatches: PantryReviewItemMatch[];
  softMatchesNeedingReview: PantryReviewItemWithCandidates[];
  multipleMatchesNeedingReview: PantryReviewItemWithCandidates[];
}

function normalizeText(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, '');
}

function toCandidate(pantryItem: any): PantryReviewCandidate {
  return {
    id: pantryItem.id,
    name: pantryItem.name,
    unit: pantryItem.unit ?? null,
    size_amount: pantryItem.size_amount ?? null,
    size_unit: pantryItem.size_unit ?? null,
  };
}

function isExactNameMatch(a: string, b: string): boolean {
  return normalizeText(a) === normalizeText(b);
}

export function classifyPantryMoveItems(
  listItems: any[],
  pantryItems: any[]
): PantryReviewResult {
  const result: PantryReviewResult = {
    newItems: [],
    exactMatches: [],
    softMatchesNeedingReview: [],
    multipleMatchesNeedingReview: [],
  };

  for (const item of listItems) {
    const matchingCandidates = pantryItems.filter((pantryItem) =>
      isIngredientMatch(item.name, pantryItem.name)
    );

    if (matchingCandidates.length === 0) {
      result.newItems.push(item);
      continue;
    }

    if (matchingCandidates.length > 1) {
      result.multipleMatchesNeedingReview.push({
        item,
        candidates: matchingCandidates.map(toCandidate),
      });
      continue;
    }

    const candidate = matchingCandidates[0];

    if (isExactNameMatch(item.name, candidate.name)) {
      result.exactMatches.push({
        item,
        candidate: toCandidate(candidate),
      });
      continue;
    }

    result.softMatchesNeedingReview.push({
      item,
      candidates: [toCandidate(candidate)],
    });
  }

  return result;
}