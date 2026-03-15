import { PlannedMeal } from './planned-meal.model';

export interface DayPlan {
  day: string;
  date: number;
  fullDate: string;
  meals: PlannedMeal[];
}