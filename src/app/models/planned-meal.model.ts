import { Meal } from './meal.model';
import { FamilyMember } from './family-member.model';

export type PlannedMealStatus =
  | 'to-prepare'
  | 'in-progress'
  | 'ready-to-serve';

export interface PlannedMeal {
  id: string;
  meal: Meal;
  cook?: FamilyMember;
  status: PlannedMealStatus;
}