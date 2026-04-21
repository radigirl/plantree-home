import { Injectable } from '@angular/core';
import { Meal } from '../models/meal.model';
import { SupabaseService } from './supabase.service';

export type MealUsageAction = 'delete' | 'archive' | 'cancel';

@Injectable({
  providedIn: 'root',
})
export class MealsService {
  constructor(private supabaseService: SupabaseService) { }

  async getMeals(memberId: number, includeArchived = false): Promise<Meal[]> {
  let query = this.supabaseService.supabase
    .from('meals')
    .select(`
      id,
      name,
      prep_time,
      ingredients,
      image_url,
      created_at,
      instructions
    `)
    .order('created_at', { ascending: false });

  const { data: mealsData, error } = await query;

  if (error) {
    console.error('Error fetching meals:', error);
    return [];
  }

  const { data: hiddenData } = await this.supabaseService.supabase
    .from('member_meals')
    .select('meal_id')
    .eq('member_id', memberId)
    .eq('is_hidden', true);

  const hiddenIds = new Set(hiddenData?.map((h) => h.meal_id));

  return (mealsData ?? [])
    .filter((item) => !hiddenIds.has(item.id))
    .map((item): Meal => {
      const imageUrl = this.supabaseService.getMealImageUrl(item.image_url);

      return {
        id: item.id,
        name: item.name,
        prepTime: item.prep_time ?? undefined,
        ingredients: item.ingredients ?? [],
        image_url: imageUrl ?? undefined,
        image_path: item.image_url ?? undefined,
        instructions: item.instructions ?? undefined,
      };
    });
}

async getAllMeals(): Promise<Meal[]> {
  const { data, error } = await this.supabaseService.supabase
    .from('meals')
    .select(`
      id,
      name,
      prep_time,
      ingredients,
      image_url,
      instructions
    `)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching all meals:', error);
    return [];
  }

  return (data ?? []).map((item) => {
    const imageUrl =
      this.supabaseService.getMealImageUrl(item.image_url);

    return {
      id: item.id,
      name: item.name,
      prepTime: item.prep_time ?? undefined,
      ingredients: item.ingredients ?? [],
      image_url: imageUrl ?? undefined,
      image_path: item.image_url ?? undefined,
      instructions: item.instructions ?? undefined,
    };
  });
}

  async createMeal(
    name: string,
    prepTime: number | null,
    ingredients: string[],
    imagePath?: string | null,
    instructions?: string | null
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
        instructions: instructions?.trim() ? instructions.trim() : null,
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
    imagePath?: string,
    instructions?: string | null,
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
      instructions?: string | null;
    } = {
      name,
      prep_time: prepTime ?? null,
      ingredients,
      instructions: instructions?.trim() ? instructions.trim() : null,
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

  async hideMealForMember(mealId: string, memberId: number): Promise<void> {
    const { error } = await this.supabaseService.supabase
      .from('member_meals')
      .upsert({
        member_id: memberId,
        meal_id: mealId,
        is_hidden: true,
      });

    if (error) {
      console.error('Error hiding meal for member:', error);
      throw error;
    }
  }



}