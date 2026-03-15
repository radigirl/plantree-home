import { Injectable } from '@angular/core';
import { DayPlan } from '../models/day-plan.model';
import { PlannedMeal } from '../models/planned-meal.model';
import { SupabaseService } from './supabase.service';

@Injectable({
  providedIn: 'root',
})
export class MealPlanService {

  constructor(private supabaseService: SupabaseService) { }

  async getWeekPlan(): Promise<DayPlan[]> {

    const { data, error } = await this.supabaseService.supabase
      .from('planned_meals')
      .select(`
    id,
    planned_date,
    status,
    meal:meals!planned_meals_meal_id_fkey (
      id,
      name,
      prep_time,
      ingredients,
      image_url
    ),
    cook:users!planned_meals_cook_user_id_fkey (
      id,
      name,
      avatar_url
    )
  `)
      .order('planned_date', { ascending: true });

    if (error) {
      console.error('Error fetching week plan:', error);
      return [];
    }

    const grouped = new Map<string, DayPlan>();

    for (const item of data ?? []) {

      const plannedDate = new Date(item.planned_date);
      const dayKey = item.planned_date;

      const dayLabel = plannedDate.toLocaleDateString('en-US', {
        weekday: 'short'
      });

      const dayDate = plannedDate.getDate();

      const mealData = Array.isArray(item.meal) ? item.meal[0] : item.meal;
      const cookData = Array.isArray(item.cook) ? item.cook[0] : item.cook;

      if (!mealData || !cookData) {
        continue;
      }

      const plannedMeal: PlannedMeal = {
        id: item.id,
        status: item.status,
        meal: {
          id: mealData.id,
          name: mealData.name,
          prepTime: mealData.prep_time,
          ingredients: mealData.ingredients ?? [],
          image: mealData.image_url
        },
        cook: {
          id: String(cookData.id),
          name: cookData.name,
          avatar_url: cookData.avatar_url
        }
      };

      if (!grouped.has(dayKey)) {
        grouped.set(dayKey, {
          day: dayLabel,
          date: dayDate,
          meals: [plannedMeal]
        });
      } else {
        grouped.get(dayKey)?.meals.push(plannedMeal);
      }
    }

    return Array.from(grouped.values());
  }
}