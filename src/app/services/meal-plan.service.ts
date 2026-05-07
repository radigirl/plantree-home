import { Injectable } from '@angular/core';
import { DayPlan } from '../models/day-plan.model';
import { PlannedMeal } from '../models/planned-meal.model';
import { SupabaseService } from './supabase.service';
import { SpaceStateService } from './space.state.service';
import { LanguageStateService } from './language.state.service';

@Injectable({
  providedIn: 'root',
})
export class MealPlanService {
  constructor(
    private supabaseService: SupabaseService,
    private spaceStateService: SpaceStateService,
    private languageStateService: LanguageStateService
  ) { }

  async getWeekPlan(weekStart: Date): Promise<DayPlan[]> {
    const spaceId = this.spaceStateService.getCurrentSpace()?.id;

    if (!spaceId) {
      return [];
    }

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
        completed_at,
        meal:meals!planned_meals_meal_id_fkey (
          id,   
          name,
          prep_time,
          ingredients,
          image_url,
          instructions,
          created_at
        ),
        cook:members!planned_meals_cook_member_id_fkey (
          id,
          name,
          avatar_url,
          created_at
        )
      `)
      .eq('space_id', spaceId)
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

      const daysShort = this.languageStateService.t('daysShort') as unknown as string[];
      const label = daysShort[date.getDay()];

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

      if (!mealData) {
        continue;
      }

      const plannedMeal: PlannedMeal = {
        id: item.id,
        status: item.status,
        completed_at: item.completed_at ?? null,
        meal: {
          id: mealData.id,
          name: mealData.name,
          prepTime: mealData.prep_time ?? undefined,
          ingredients: mealData.ingredients ?? [],
          image_url:
            this.supabaseService.getMealImageUrl(mealData.image_url) ??
            undefined,
          instructions: mealData.instructions ?? undefined,
        },
        cook: cookData
          ? {
            id: cookData.id,
            name: cookData.name,
            avatar_url: cookData.avatar_url ?? undefined,
            created_at: cookData.created_at,
          }
          : undefined,
      };

      week[dayIndex].meals.push(plannedMeal);
    }

    return week;
  }

  async getMealsForDate(date: string): Promise<PlannedMeal[]> {
    const spaceId = this.spaceStateService.getCurrentSpace()?.id;

    if (!spaceId) {
      return [];
    }

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
          image_url,
          instructions,
          created_at
        ),
        cook:members!planned_meals_cook_member_id_fkey (
          id,
          name,
          avatar_url,
          created_at
        )
      `)
      .eq('space_id', spaceId)
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
          prepTime: mealData.prep_time ?? undefined,
          ingredients: mealData.ingredients ?? [],
          image_url:
            this.supabaseService.getMealImageUrl(mealData.image_url) ??
            undefined,
          instructions: mealData.instructions ?? undefined,
        },
        cook: cookData
          ? {
            id: cookData.id,
            name: cookData.name,
            avatar_url: cookData.avatar_url ?? undefined,
            created_at: cookData.created_at,
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
    cookMemberId: number | null,
    date: string,
    imagePath?: string | null,
    instructions?: string | null,
    ingredients?: string[]
  ): Promise<void> {

    const spaceId = this.spaceStateService.getCurrentSpace()?.id;

    if (!spaceId) {
      throw new Error('No current space selected.');
    }

    const mealId = crypto.randomUUID();

    const { error: mealError } = await this.supabaseService.supabase
      .from('meals')
      .insert({
        id: mealId,
        name,
        prep_time: prepTime ?? null,
        ingredients: ingredients ?? [],
        instructions: instructions?.trim() || null,
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
        cook_member_id: cookMemberId,
        planned_date: date,
        status: 'to-prepare',
        space_id: spaceId,
      });

    if (planError) {
      console.error('Error creating planned meal:', planError);
      throw planError;
    }
  }

  async createMealAndReplacePlannedMeal(
    plannedMealId: string,
    name: string,
    prepTime: number | null,
    cookMemberId: number | null,
    imagePath?: string | null,
    instructions?: string | null,
    ingredients?: string[]
  ): Promise<void> {
    const spaceId = this.spaceStateService.getCurrentSpace()?.id;

    if (!spaceId) {
      throw new Error('No current space selected.');
    }

    const mealId = crypto.randomUUID();

    const { error: mealError } = await this.supabaseService.supabase
      .from('meals')
      .insert({
        id: mealId,
        name,
        prep_time: prepTime ?? null,
        ingredients: ingredients ?? [],
        instructions: instructions?.trim() || null,
        image_url: imagePath ?? null,
      });

    if (mealError) {
      console.error('Error creating replacement meal:', mealError);
      throw mealError;
    }

    const { error: updatePlannedError } = await this.supabaseService.supabase
      .from('planned_meals')
      .update({
        meal_id: mealId,
        cook_member_id: cookMemberId,
      })
      .eq('id', plannedMealId)
      .eq('space_id', spaceId);

    if (updatePlannedError) {
      console.error(
        'Error replacing planned meal meal_id:',
        updatePlannedError
      );
      throw updatePlannedError;
    }
  }

  async getAvailableMealsForPlanning(memberId: number): Promise<
    {
      id: string;
      name: string;
      prepTime?: number;
      ingredients?: string[];
      image_url?: string;
      instructions?: string;
      created_at: string;
    }[]
  > {
    const { data, error } = await this.supabaseService.supabase
      .from('meals')
      .select(`
        id,
        name,
        prep_time,
        image_url,
        instructions,
        ingredients,
        created_at
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching available meals:', error);
      return [];
    }

    const { data: hiddenData } = await this.supabaseService.supabase
      .from('member_meals')
      .select('meal_id')
      .eq('member_id', memberId)
      .eq('is_hidden', true);

    const hiddenIds = new Set(hiddenData?.map((h) => h.meal_id));

    return (data ?? [])
      .filter((item) => !hiddenIds.has(item.id))
      .map((item) => ({
        id: item.id,
        name: item.name,
        prepTime: item.prep_time ?? undefined,
        ingredients: item.ingredients ?? [],
        image_url:
          this.supabaseService.getMealImageUrl(item.image_url) ?? undefined,
        instructions: item.instructions ?? undefined,
        created_at: item.created_at,
      }));
  }

  async updatePlannedMealMeal(
    plannedMealId: string,
    mealId: string,
    cookMemberId: number | null
  ): Promise<void> {
    const { error } = await this.supabaseService.supabase
      .from('planned_meals')
      .update({
        meal_id: mealId,
        cook_member_id: cookMemberId,
      })
      .eq('id', plannedMealId);

    if (error) {
      console.error('Error updating planned meal meal_id:', error);
      throw error;
    }

    return;
  }

  async updatePlannedMealStatus(
    plannedMealId: string,
    status: 'to-prepare' | 'in-progress' | 'ready-to-serve'
  ): Promise<void> {
    const payload = {
      status,
      completed_at:
        status === 'ready-to-serve' ? new Date().toISOString() : null,
    };

    const { error } = await this.supabaseService.supabase
      .from('planned_meals')
      .update(payload)
      .eq('id', plannedMealId)
      .select();

    if (error) {
      console.error('Error updating planned meal status:', error);
      throw error;
    }
  }

  async deletePlannedMeal(plannedMealId: string): Promise<void> {
    const { error } = await this.supabaseService.supabase
      .from('planned_meals')
      .delete()
      .eq('id', plannedMealId);

    if (error) {
      console.error('Error deleting planned meal:', error);
      throw error;
    }
  }

  async updatePlannedMealCook(
    plannedMealId: string,
    cookMemberId: number | null
  ): Promise<void> {
    const { error } = await this.supabaseService.supabase
      .from('planned_meals')
      .update({ cook_member_id: cookMemberId })
      .eq('id', plannedMealId);

    if (error) {
      console.error('Error updating planned meal cook:', error);
      throw error;
    }
  }

  async createPlannedMealFromExistingMeal(
    mealId: string,
    cookMemberId: number | null,
    date: string
  ): Promise<void> {
    const spaceId = this.spaceStateService.getCurrentSpace()?.id;

    if (!spaceId) {
      throw new Error('No current space selected.');
    }

    const plannedId = crypto.randomUUID();

    const { error } = await this.supabaseService.supabase
      .from('planned_meals')
      .insert({
        id: plannedId,
        meal_id: mealId,
        cook_member_id: cookMemberId,
        planned_date: date,
        status: 'to-prepare',
        space_id: spaceId,
      });

    if (error) {
      console.error('Error creating planned meal from existing meal:', error);
      throw error;
    }
  }

  private formatDateLocal(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  }

  async getMealById(mealId: string): Promise<{
    id: string;
    name: string;
    prepTime?: number;
    ingredients?: string[];
    image_url?: string;
    instructions?: string;
    created_at: string;
  } | null> {
    const { data, error } = await this.supabaseService.supabase
      .from('meals')
      .select(`
        id,
        name,
        prep_time,
        ingredients,
        image_url,
        instructions,
        created_at
      `)
      .eq('id', mealId)
      .single();

    if (error) {
      console.error('Error fetching meal by id:', error);
      return null;
    }

    return {
      id: data.id,
      name: data.name,
      prepTime: data.prep_time ?? undefined,
      ingredients: data.ingredients ?? [],
      image_url:
        this.supabaseService.getMealImageUrl(data.image_url) ?? undefined,
      instructions: data.instructions ?? undefined,
      created_at: data.created_at,
    };
  }

  async getCoverageForMeals(
    mealIds: string[]
  ): Promise<Array<{ mealId: string; listName: string }>> {
    if (!mealIds.length) {
      return [];
    }

    const spaceId = this.spaceStateService.getCurrentSpace()?.id;

    if (!spaceId) {
      return [];
    }

    const { data, error } = await this.supabaseService.supabase
      .from('grocery_lists')
      .select('name, generated, status, metadata')
      .eq('space_id', spaceId)
      .eq('generated', true)
      .eq('status', 'active');

    if (error) {
      console.error('Error fetching grocery list coverage:', error);
      return [];
    }

    const requestedIds = new Set(mealIds.map(String));
    const result: Array<{ mealId: string; listName: string }> = [];

    for (const list of data ?? []) {
      const metadata = list.metadata as any;
      const coveredMealIds: string[] = Array.isArray(metadata?.mealIds)
        ? metadata.mealIds.map(String)
        : [];

      for (const mealId of coveredMealIds) {
        if (requestedIds.has(mealId)) {
          result.push({
            mealId,
            listName: list.name,
          });
        }
      }
    }

    return result;
  }

  async getCookedMealsForWeek(weekStart: Date): Promise<PlannedMeal[]> {
    const spaceId = this.spaceStateService.getCurrentSpace()?.id;

    if (!spaceId) {
      return [];
    }

    const start = new Date(weekStart);
    start.setHours(0, 0, 0, 0);

    const nextWeekStart = new Date(start);
    nextWeekStart.setDate(start.getDate() + 7);

    const { data, error } = await this.supabaseService.supabase
      .from('planned_meals')
      .select(`
      id,
      planned_date,
      status,
      created_at,
      completed_at,
      meal:meals!planned_meals_meal_id_fkey (
        id,
        name,
        prep_time,
        ingredients,
        image_url,
        instructions,
        created_at
      ),
      cook:members!planned_meals_cook_member_id_fkey (
        id,
        name,
        avatar_url,
        created_at
      )
    `)
      .eq('space_id', spaceId)
      .eq('status', 'ready-to-serve')
      .gte('completed_at', start.toISOString())
      .lt('completed_at', nextWeekStart.toISOString())
      .order('completed_at', { ascending: false });

    if (error) {
      console.error('Error fetching cooked meals for week:', error);
      return [];
    }

    const meals: PlannedMeal[] = [];

    for (const item of data ?? []) {
      const mealData = Array.isArray(item.meal) ? item.meal[0] : item.meal;
      const cookData = Array.isArray(item.cook) ? item.cook[0] : item.cook;

      if (!mealData) {
        continue;
      }

      meals.push({
        id: item.id,
        status: item.status,
        completed_at: item.completed_at ?? null,
        meal: {
          id: mealData.id,
          name: mealData.name,
          prepTime: mealData.prep_time ?? undefined,
          ingredients: mealData.ingredients ?? [],
          image_url:
            this.supabaseService.getMealImageUrl(mealData.image_url) ??
            undefined,
          instructions: mealData.instructions ?? undefined,
        },
        cook: cookData
          ? {
            id: cookData.id,
            name: cookData.name,
            avatar_url: cookData.avatar_url ?? undefined,
            created_at: cookData.created_at,
          }
          : undefined,
      });
    }

    return meals;
  }

  async getMembersForStats(): Promise<
    { id: number; name: string; avatar_url?: string; created_at?: string }[]
  > {
    const { data, error } = await this.supabaseService.supabase
      .from('members')
      .select('id, name, avatar_url, created_at')
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching members for stats:', error);
      return [];
    }

    return data ?? [];
  }

}