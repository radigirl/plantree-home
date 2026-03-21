import { Injectable } from '@angular/core';
import { Meal } from '../models/meal.model';
import { SupabaseService } from './supabase.service';

export type MealUsageAction = 'delete' | 'archive' | 'cancel';

@Injectable({
  providedIn: 'root',
})
export class MealsService {
  constructor(private supabaseService: SupabaseService) {}

  async getMeals(userId: number, includeArchived = false): Promise<Meal[]> {
  let query = this.supabaseService.supabase
    .from('meals')
    .select(`
      id,
      name,
      prep_time,
      ingredients,
      image_url,
      is_archived
    `)
    .order('created_at', { ascending: false });

  if (!includeArchived) {
    query = query.eq('is_archived', false);
  }

  const { data: mealsData, error } = await query;

  if (error) {
    console.error('Error fetching meals:', error);
    return [];
  }

  // get hidden meals for this user
  const { data: hiddenData } = await this.supabaseService.supabase
    .from('user_meals')
    .select('meal_id')
    .eq('user_id', userId)
    .eq('is_hidden', true);

  const hiddenIds = new Set(hiddenData?.map((h) => h.meal_id));

  return (mealsData ?? [])
    .filter((item) => !hiddenIds.has(item.id))
    .map((item) => {
      const imageUrl = this.supabaseService.getMealImageUrl(item.image_url);

      return {
        id: item.id,
        name: item.name,
        prepTime: item.prep_time ?? undefined,
        ingredients: item.ingredients ?? [],
        image: imageUrl ?? undefined,
      };
    });
}

  async createMeal(
    name: string,
    prepTime: number | null,
    ingredients: string[],
    imagePath?: string | null
  ): Promise<void> {
    const mealId = crypto.randomUUID();

    const { error } = await this.supabaseService.supabase
      .from('meals')
      .insert({
        id: mealId,
        name,
        prep_time: prepTime ?? null,
        ingredients,
        image_url: imagePath ?? null,
        is_archived: false,
      });

    if (error) {
      console.error('Error creating meal:', error);
      throw error;
    }
  }

  async updateMeal(
    mealId: string,
    name: string,
    prepTime: number | null,
    ingredients: string[],
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
      ingredients: string[];
      image_url?: string | null;
    } = {
      name,
      prep_time: prepTime ?? null,
      ingredients,
    };

    if (imagePath !== undefined) {
      payload.image_url = imagePath;
    }

    const { error } = await this.supabaseService.supabase
      .from('meals')
      .update(payload)
      .eq('id', mealId);

    if (error) {
      console.error('Error updating meal:', error);
      throw error;
    }
  }

  async isMealUsedInPlan(mealId: string): Promise<boolean> {
    const { data, error } = await this.supabaseService.supabase
      .from('planned_meals')
      .select('id')
      .eq('meal_id', mealId)
      .limit(1);

    if (error) {
      console.error('Error checking meal usage:', error);
      throw error;
    }

    return (data?.length ?? 0) > 0;
  }

  async archiveMeal(mealId: string): Promise<void> {
    const { error } = await this.supabaseService.supabase
      .from('meals')
      .update({ is_archived: true })
      .eq('id', mealId);

    if (error) {
      console.error('Error archiving meal:', error);
      throw error;
    }
  }

  async deleteMealEverywhere(mealId: string): Promise<void> {
    const { data: mealData, error: fetchMealError } = await this.supabaseService.supabase
      .from('meals')
      .select('image_url')
      .eq('id', mealId)
      .single();

    if (fetchMealError) {
      console.error('Error fetching meal before delete:', fetchMealError);
      throw fetchMealError;
    }

    const imagePath = mealData?.image_url ?? null;

    const { error: deletePlannedError } = await this.supabaseService.supabase
      .from('planned_meals')
      .delete()
      .eq('meal_id', mealId);

    if (deletePlannedError) {
      console.error('Error deleting planned meals for meal:', deletePlannedError);
      throw deletePlannedError;
    }

    if (imagePath && imagePath.startsWith('meals/')) {
      try {
        await this.supabaseService.deleteMealImage(imagePath);
      } catch (error) {
        console.error('Error deleting meal image during delete everywhere:', error);
      }
    }

    const { error: deleteMealError } = await this.supabaseService.supabase
      .from('meals')
      .delete()
      .eq('id', mealId);

    if (deleteMealError) {
      console.error('Error deleting meal row:', deleteMealError);
      throw deleteMealError;
    }
  }

  async deleteUnusedMeal(mealId: string): Promise<void> {
    const { data: mealData, error: fetchMealError } = await this.supabaseService.supabase
      .from('meals')
      .select('image_url')
      .eq('id', mealId)
      .single();

    if (fetchMealError) {
      console.error('Error fetching meal before delete:', fetchMealError);
      throw fetchMealError;
    }

    const imagePath = mealData?.image_url ?? null;

    if (imagePath && imagePath.startsWith('meals/')) {
      try {
        await this.supabaseService.deleteMealImage(imagePath);
      } catch (error) {
        console.error('Error deleting meal image during unused delete:', error);
      }
    }

    const { error: deleteMealError } = await this.supabaseService.supabase
      .from('meals')
      .delete()
      .eq('id', mealId);

    if (deleteMealError) {
      console.error('Error deleting unused meal:', deleteMealError);
      throw deleteMealError;
    }
  }

  async hideMealForUser(mealId: string, userId: number): Promise<void> {
  const { error } = await this.supabaseService.supabase
    .from('user_meals')
    .upsert({
      user_id: userId,
      meal_id: mealId,
      is_hidden: true,
    });

  if (error) {
    console.error('Error hiding meal for user:', error);
    throw error;
  }
}



}