import { Meal } from '../../models/meal.model';

function normalizeSearchValue(value: string): string {
  return value.trim().toLowerCase();
}

function mealNameMatches(meal: Meal, query: string): boolean {
  return meal.name.toLowerCase().includes(query);
}

function mealIngredientsMatch(meal: Meal, query: string): boolean {
  return (meal.ingredients ?? []).some((ingredient) =>
    ingredient.toLowerCase().includes(query)
  );
}

export function mealMatchesQuery(meal: Meal, rawQuery: string): boolean {
  const query = normalizeSearchValue(rawQuery);

  if (!query) {
    return true;
  }

  return mealNameMatches(meal, query) || mealIngredientsMatch(meal, query);
}

export function filterMealsByQuery<T extends Meal>(
  meals: T[],
  rawQuery: string
): T[] {
  const query = normalizeSearchValue(rawQuery);

  if (!query) {
    return meals;
  }

  return meals.filter((meal) => mealMatchesQuery(meal, query));
}