import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';

export interface IngredientWordRule {
  space_id: string;
  singular_text: string;
  plural_text: string;
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
}