import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { MergeCandidate } from '../shared/components/merge-review-sheet/merge-review-sheet.component';

export interface IngredientWordRule {
  id?: string;
  space_id: string;
  singular_text: string;
  plural_text: string;
  created_at?: string;
  updated_at?: string;
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
  constructor(private supabaseService: SupabaseService) { }

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
      .eq('space_id', spaceId)
      .order('singular_text', { ascending: true });

    if (error) {
      console.error('Error loading ingredient word rules:', error);
      return [];
    }

    return (data ?? []) as IngredientWordRule[];
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
      .order('ingredient_name', { ascending: true })
      .order('measurement_style', { ascending: true });

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

  async deleteWordRule(ruleId: string): Promise<boolean> {
    const { error } = await this.supabase
      .from('ingredient_word_rules')
      .delete()
      .eq('id', ruleId);

    if (error) {
      console.error('Error deleting word rule:', error);
      return false;
    }

    return true;
  }

  async deleteMeasurementRule(ruleId: string): Promise<boolean> {
    const { error } = await this.supabase
      .from('ingredient_measurement_rules')
      .delete()
      .eq('id', ruleId);

    if (error) {
      console.error('Error deleting measurement rule:', error);
      return false;
    }

    return true;
  }

  async filterRememberedWordCandidates(
    spaceId: string,
    candidates: MergeCandidate[]
  ): Promise<MergeCandidate[]> {
    if (!spaceId || !candidates.length) {
      return [];
    }

    const rules = await this.getWordRules(spaceId);

    return candidates.filter((candidate) => {
      const singular = candidate.singularText.trim().toLowerCase();
      const plural = candidate.pluralText.trim().toLowerCase();

      return !rules.some((rule) => {
        const ruleSingular = rule.singular_text.trim().toLowerCase();
        const rulePlural = rule.plural_text.trim().toLowerCase();

        return (
          ruleSingular === singular &&
          rulePlural === plural
        );
      });
    });
  }

  async saveMergeCandidatesAsWordRules(
    spaceId: string,
    candidates: MergeCandidate[]
  ): Promise<boolean> {
    if (!spaceId || !candidates.length) {
      return true;
    }

    return this.saveWordRules(
      candidates.map((candidate) => ({
        spaceId,
        singularText: candidate.singularText,
        pluralText: candidate.pluralText,
      }))
    );
  }

}