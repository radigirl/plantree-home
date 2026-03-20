import { Injectable } from '@angular/core';
import { DayPlan } from '../models/day-plan.model';
import { PlannedMeal } from '../models/planned-meal.model';
import { SupabaseService } from './supabase.service';

@Injectable({
  providedIn: 'root',
})
export class MealPlanService {
  constructor(private supabaseService: SupabaseService) { }

  async getWeekPlan(weekStart: Date): Promise<DayPlan[]> {
    const monday = new Date(weekStart);

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    const startDate = this.formatDateLocal(monday);
    const endDate = this.formatDateLocal(sunday);

    const { data, error } = await this.supabaseService.supabase
      .from('planned_meals')
      .select(`
        id,
        planned_date,
        status,
        created_at,
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
      .gte('planned_date', startDate)
      .lte('planned_date', endDate)
      .order('planned_date', { ascending: true })
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching week plan:', error);
      return [];
    }

    const week: DayPlan[] = [];

    for (let i = 0; i < 7; i++) {
      const date = new Date(monday);
      date.setDate(monday.getDate() + i);

      const label = date.toLocaleDateString('en-US', {
        weekday: 'short',
      });

      week.push({
        day: label,
        date: date.getDate(),
        fullDate: this.formatDateLocal(date),
        meals: [],
      });
    }

    for (const item of data ?? []) {
      const plannedDate = new Date(item.planned_date);
      const dayIndex = (plannedDate.getDay() + 6) % 7;

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
          image: mealData.image_url?.startsWith('assets/')
            ? mealData.image_url
            : this.supabaseService.getMealImageUrl(mealData.image_url),
        },
        cook: {
          id: cookData.id,
          name: cookData.name,
          avatar_url: cookData.avatar_url,
        },
      };

      week[dayIndex].meals.push(plannedMeal);
    }

    return week;
  }

  async getMealsForDate(date: string): Promise<PlannedMeal[]> {
    const { data, error } = await this.supabaseService.supabase
      .from('planned_meals')
      .select(`
        id,
        planned_date,
        status,
        created_at,
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
      .eq('planned_date', date)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching meals for date:', error);
      return [];
    }

    const meals: PlannedMeal[] = [];

    for (const item of data ?? []) {
      const mealData = Array.isArray(item.meal) ? item.meal[0] : item.meal;
      const cookData = Array.isArray(item.cook) ? item.cook[0] : item.cook;

      if (!mealData) {
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
          image: mealData.image_url?.startsWith('assets/')
            ? mealData.image_url
            : this.supabaseService.getMealImageUrl(mealData.image_url),
        },
        cook: cookData
          ? {
            id: cookData.id,
            name: cookData.name,
            avatar_url: cookData.avatar_url,
          }
          : undefined,
      };

      meals.push(plannedMeal);
    }

    return meals;
  }

  async createMealAndPlan(
    name: string,
    prepTime: number | null,
    cookUserId: number | null,
    date: string,
    imagePath?: string | null
  ): Promise<void> {
    const mealId = crypto.randomUUID();

    const { error: mealError } = await this.supabaseService.supabase
      .from('meals')
      .insert({
        id: mealId,
        name,
        prep_time: prepTime ?? null,
        ingredients: [],
        image_url: imagePath ?? null,
      });

    if (mealError) {
      console.error('Error creating meal:', mealError);
      throw mealError;
    }

    const plannedId = crypto.randomUUID();

    const { error: planError } = await this.supabaseService.supabase
      .from('planned_meals')
      .insert({
        id: plannedId,
        meal_id: mealId,
        cook_user_id: cookUserId,
        planned_date: date,
        status: 'to-prepare',
      });

    if (planError) {
      console.error('Error creating planned meal:', planError);
      throw planError;
    }
  }

  async updatePlannedMealStatus(
    plannedMealId: string,
    status: 'to-prepare' | 'in-progress' | 'ready-to-serve'
  ): Promise<void> {
    const { data, error } = await this.supabaseService.supabase
      .from('planned_meals')
      .update({ status })
      .eq('id', plannedMealId)
      .select();

    if (error) {
      console.error('Error updating planned meal status:', error);
      throw error;
    }

    console.log('Updated rows:', data);
  }

  async deletePlannedMeal(plannedMealId: string): Promise<void> {
    const { data: plannedMeal, error: fetchPlannedError } = await this.supabaseService.supabase
      .from('planned_meals')
      .select('meal_id')
      .eq('id', plannedMealId)
      .single();

    if (fetchPlannedError) {
      console.error('Error fetching planned meal before delete:', fetchPlannedError);
      throw fetchPlannedError;
    }

    const mealId = plannedMeal?.meal_id;

    let imagePath: string | null = null;

    if (mealId) {
      const { data: mealData, error: fetchMealError } = await this.supabaseService.supabase
        .from('meals')
        .select('image_url')
        .eq('id', mealId)
        .single();

      if (fetchMealError) {
        console.error('Error fetching meal image before delete:', fetchMealError);
        throw fetchMealError;
      }

      imagePath = mealData?.image_url ?? null;
    }

    if (imagePath && imagePath.startsWith('meals/')) {
      try {
        await this.supabaseService.deleteMealImage(imagePath);
      } catch (error) {
        console.error('Error deleting meal image during delete:', error);
      }
    }

    const { error: deletePlannedError } = await this.supabaseService.supabase
      .from('planned_meals')
      .delete()
      .eq('id', plannedMealId);

    if (deletePlannedError) {
      console.error('Error deleting planned meal:', deletePlannedError);
      throw deletePlannedError;
    }

    if (mealId) {
      const { error: deleteMealError } = await this.supabaseService.supabase
        .from('meals')
        .delete()
        .eq('id', mealId);

      if (deleteMealError) {
        console.error('Error deleting meal row:', deleteMealError);
        throw deleteMealError;
      }
    }
  }

  async updateMealDetails(
    mealId: string,
    name: string,
    prepTime: number | null,
    imagePath?: string
  ): Promise<void> {
    const { data: existingMeal, error: fetchError } = await this.supabaseService.supabase
      .from('meals')
      .select('image_url')
      .eq('id', mealId)
      .single();

    if (fetchError) {
      console.error('Error fetching existing meal image:', fetchError);
      throw fetchError;
    }

    const oldImagePath = existingMeal?.image_url ?? null;

    if (
      imagePath &&
      oldImagePath &&
      oldImagePath !== imagePath &&
      oldImagePath.startsWith('meals/')
    ) {
      try {
        await this.supabaseService.deleteMealImage(oldImagePath);
      } catch (error) {
        console.error('Error deleting old meal image during update:', error);
      }
    }

    const payload: {
      name: string;
      prep_time: number | null;
      image_url?: string | null;
    } = {
      name,
      prep_time: prepTime ?? null,
    };

    if (imagePath !== undefined) {
      payload.image_url = imagePath;
    }

    const { error } = await this.supabaseService.supabase
      .from('meals')
      .update(payload)
      .eq('id', mealId);

    if (error) {
      console.error('Error updating meal details:', error);
      throw error;
    }
  }

  async updatePlannedMealCook(
    plannedMealId: string,
    cookUserId: number | null
  ): Promise<void> {
    const { error } = await this.supabaseService.supabase
      .from('planned_meals')
      .update({ cook_user_id: cookUserId })
      .eq('id', plannedMealId);

    if (error) {
      console.error('Error updating planned meal cook:', error);
      throw error;
    }
  }

  private formatDateLocal(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  }
}