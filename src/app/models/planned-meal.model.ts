import { Meal } from './meal.model';
import { Member } from './member.model';

export type PlannedMealStatus =
  | 'to-prepare'
  | 'in-progress'
  | 'ready-to-serve';

export interface PlannedMeal {
  id: string;
  meal: Meal;
  cook?: Member;
  status: PlannedMealStatus;
  completed_at?: string | null;
}