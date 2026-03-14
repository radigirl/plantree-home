import { Injectable } from '@angular/core';
import { DayPlan } from '../models/day-plan.model';
import { WEEK_PLAN_MOCK } from '../data/week-plan.mock';

@Injectable({
  providedIn: 'root',
})
export class MealPlanService {
  getWeekPlan(): DayPlan[] {
    return WEEK_PLAN_MOCK;
  }
}