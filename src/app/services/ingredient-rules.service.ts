import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';

export interface IngredientWordRule {
  space_id: string;
  singular_text: string;
  plural_text: string;
}

export interface MeasurementRulePayload {
  spaceId: string;
  ingredientName: string;
  measurementStyle: string;
  convertedAmount: number;
  convertedUnit: string;
}

export interface MeasurementRuleRow {
  id: string;
  space_id: string;
  ingredient_name: string;
  measurement_style: string;
  converted_amount: number;
  converted_unit: string;
  created_at: string;
  updated_at: string;
}

@Injectable({
  providedIn: 'root',
})
export class IngredientRulesService {
  constructor(private supabaseService: SupabaseService) {}

  private get supabase() {
    return this.supabaseService.supabase;
  }

  // SAVE WORD RULES
  async saveWordRules(
    rules: Array<{
      spaceId: string;
      singularText: string;
      pluralText: string;
    }>
  ): Promise<boolean> {
    if (!rules.length) {
      return true;
    }

    const payload: IngredientWordRule[] = rules.map((rule) => ({
      space_id: rule.spaceId,
      singular_text: rule.singularText,
      plural_text: rule.pluralText,
    }));

    const { error } = await this.supabase
      .from('ingredient_word_rules')
      .upsert(payload, {
        onConflict: 'space_id,singular_text,plural_text',
      });

    if (error) {
      console.error('Error saving ingredient word rules:', error);
      return false;
    }

    return true;
  }

  // LOAD WORD RULES
  async getWordRules(spaceId: string): Promise<IngredientWordRule[]> {
    const { data, error } = await this.supabase
      .from('ingredient_word_rules')
      .select('*')
      .eq('space_id', spaceId);

    if (error) {
      console.error('Error loading ingredient word rules:', error);
      return [];
    }

    return data ?? [];
  }

  async saveMeasurementRule(rule: MeasurementRulePayload): Promise<void> {
  const { error } = await this.supabase
    .from('ingredient_measurement_rules')
    .upsert(
      {
        space_id: rule.spaceId,
        ingredient_name: rule.ingredientName,
        measurement_style: rule.measurementStyle,
        converted_amount: rule.convertedAmount,
        converted_unit: rule.convertedUnit,
      },
      {
        onConflict: 'space_id,ingredient_name,measurement_style',
      }
    );

  if (error) {
    console.error('Error saving measurement rule:', error);
    throw error;
  }
}

async getMeasurementRules(spaceId: string): Promise<MeasurementRuleRow[]> {
  const { data, error } = await this.supabase
    .from('ingredient_measurement_rules')
    .select('*')
    .eq('space_id', spaceId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error loading measurement rules:', error);
    return [];
  }

  return (data ?? []) as MeasurementRuleRow[];
}

async getMeasurementRule(
  spaceId: string,
  ingredientName: string,
  measurementStyle: string
): Promise<MeasurementRuleRow | null> {
  const { data, error } = await this.supabase
    .from('ingredient_measurement_rules')
    .select('*')
    .eq('space_id', spaceId)
    .eq('ingredient_name', ingredientName)
    .eq('measurement_style', measurementStyle)
    .maybeSingle();

  if (error) {
    console.error('Error loading measurement rule:', error);
    return null;
  }

  return (data as MeasurementRuleRow | null) ?? null;
}

}