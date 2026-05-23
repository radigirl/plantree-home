import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { PantryItem } from '../models/pantry-item.model';
import { SpaceStateService } from './space.state.service';
import { AlwaysPresentPantryItem } from '../models/always-present-pantry-item.model';
import {
  convertToBaseUnit,
  formatAmountForDisplay,
  normalizeUnit,
} from '../shared/utils/unit.util';
import { getIngredientSortKey } from '../shared/utils/ingredient-merge.util';
import { IngredientRulesService } from './ingredient-rules.service';
import { detectPossibleMergeCandidatesFromRawIngredients } from '../shared/utils/ingredient-merge.util';


@Injectable({
  providedIn: 'root',
})
export class PantryService {
  constructor(
    private supabaseService: SupabaseService,
    private spaceStateService: SpaceStateService,
    private ingredientRulesService: IngredientRulesService
  ) { }

  get supabase() {
    return this.supabaseService.supabase;
  }

  async getPantryItems(): Promise<PantryItem[]> {
    const spaceId = this.spaceStateService.getCurrentSpace()?.id;

    if (!spaceId) {
      return [];
    }

    const { data, error } = await this.supabase
      .from('pantry_items')
      .select('*')
      .eq('space_id', spaceId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching pantry items:', error);
      return [];
    }

    return this.sortPantryItems((data ?? []) as PantryItem[]);
  }

  async createPantryItem(payload: {
    name: string;
    amount: number;
    unit: string;
    size_amount: number | null;
    size_unit: string | null;
    expiry_date: string | null;
  }): Promise<PantryItem | null> {
    const spaceId = this.spaceStateService.getCurrentSpace()?.id;

    const trimmedName = payload.name.trim();

    if (!trimmedName || !spaceId) {
      return null;
    }

    const normalizedName = this.normalizeName(trimmedName);
    const normalizedUnit = payload.unit?.trim() || 'item';
    const normalizedSizeUnit = payload.size_unit
      ? normalizeUnit(payload.size_unit)
      : null;

    const { data: existingItems, error: fetchError } = await this.supabase
      .from('pantry_items')
      .select('*')
      .eq('space_id', spaceId)
      .eq('normalized_name', normalizedName);

    if (fetchError) {
      console.error('Error checking existing pantry item:', fetchError);
      return null;
    }

    // measured → merge by name + compatible base unit, and add size_amount
    if (normalizedUnit === 'measured') {
      const incomingSizeAmount = payload.size_amount ?? 0;
      const incomingConverted = convertToBaseUnit(
        incomingSizeAmount,
        normalizedSizeUnit
      );

      if (!incomingConverted) {
        return null;
      }

      const measuredMatch = (existingItems ?? []).find((item) => {
        const itemUnit = item.unit?.trim() || 'item';
        const itemSizeUnit = item.size_unit ? normalizeUnit(item.size_unit) : null;

        if (itemUnit !== 'measured') {
          return false;
        }

        const existingConverted = convertToBaseUnit(
          item.size_amount ?? 0,
          itemSizeUnit
        );

        return (
          !!existingConverted &&
          existingConverted.unit === incomingConverted.unit
        );
      });

      if (measuredMatch) {
        const existingSizeUnit = measuredMatch.size_unit
          ? normalizeUnit(measuredMatch.size_unit)
          : null;

        const existingConverted = convertToBaseUnit(
          measuredMatch.size_amount ?? 0,
          existingSizeUnit
        );

        if (!existingConverted) {
          return null;
        }

        const totalBaseAmount =
          existingConverted.amount + incomingConverted.amount;

        const formatted = formatAmountForDisplay(
          totalBaseAmount,
          incomingConverted.unit
        );

        const { data, error } = await this.supabase
          .from('pantry_items')
          .update({
            size_amount: formatted.amount,
            size_unit: formatted.unit,
            updated_at: new Date().toISOString(),
          })
          .eq('id', measuredMatch.id)
          .eq('space_id', spaceId)
          .select()
          .single();

        if (error) {
          console.error('Error incrementing measured pantry item:', error);
          return null;
        }

        return data as PantryItem;
      }

      const formatted = formatAmountForDisplay(
        incomingConverted.amount,
        incomingConverted.unit
      );

      const { data, error } = await this.supabase
        .from('pantry_items')
        .insert([
          {
            name: trimmedName,
            normalized_name: normalizedName,
            amount: 1,
            unit: 'measured',
            size_amount: formatted.amount,
            size_unit: formatted.unit,
            expiry_date: payload.expiry_date,
            space_id: spaceId,
          },
        ])
        .select()
        .single();

      if (error) {
        console.error('Error creating measured pantry item:', error);
        return null;
      }

      return data as PantryItem;
    }

    // COUNTABLE / ITEM → keep current exact match behavior
    const exactMatch = (existingItems ?? []).find((item) => {
      const itemUnit = item.unit?.trim() || 'item';
      const itemSizeUnit = item.size_unit ? normalizeUnit(item.size_unit) : null;

      return (
        itemUnit !== 'measured' &&
        item.size_amount === payload.size_amount &&
        itemSizeUnit === normalizedSizeUnit
      );
    });

    if (exactMatch) {
      const { data, error } = await this.supabase
        .from('pantry_items')
        .update({
          amount: exactMatch.amount + payload.amount,
          updated_at: new Date().toISOString(),
        })
        .eq('id', exactMatch.id)
        .eq('space_id', spaceId)
        .select()
        .single();

      if (error) {
        console.error('Error incrementing pantry item:', error);
        return null;
      }

      return data as PantryItem;
    }

    const { data, error } = await this.supabase
      .from('pantry_items')
      .insert([
        {
          name: trimmedName,
          normalized_name: normalizedName,
          amount: payload.amount,
          unit: normalizedUnit,
          size_amount: payload.size_amount,
          size_unit: normalizedSizeUnit,
          expiry_date: payload.expiry_date,
          space_id: spaceId,
        },
      ])
      .select()
      .single();

    if (error) {
      console.error('Error creating pantry item:', error);
      return null;
    }

    return data as PantryItem;
  }

  async updatePantryItem(
    itemId: string,
    payload: {
      name: string;
      amount: number;
      unit: string;
      size_amount: number | null;
      size_unit: string | null;
      expiry_date: string | null;
    }
  ): Promise<PantryItem | null> {
    const spaceId = this.spaceStateService.getCurrentSpace()?.id;
    const trimmedName = payload.name.trim();

    if (!trimmedName || !spaceId) {
      return null;
    }

    const normalizedName = this.normalizeName(trimmedName);
    const normalizedUnit = payload.unit?.trim() || 'item';
    const normalizedSizeUnit = payload.size_unit
      ? normalizeUnit(payload.size_unit)
      : null;

    const { data: existingItems, error: fetchError } = await this.supabase
      .from('pantry_items')
      .select('*')
      .eq('space_id', spaceId)
      .eq('normalized_name', normalizedName)
      .neq('id', itemId);

    if (fetchError) {
      console.error('Error checking pantry item during update:', fetchError);
      return null;
    }

    if (normalizedUnit === 'measured') {
      const incomingSizeAmount = payload.size_amount ?? 0;
      const incomingConverted = convertToBaseUnit(
        incomingSizeAmount,
        normalizedSizeUnit
      );

      if (!incomingConverted) {
        return null;
      }

      const measuredMatch = (existingItems ?? []).find((item) => {
        const itemUnit = item.unit?.trim() || 'item';
        const itemSizeUnit = item.size_unit ? normalizeUnit(item.size_unit) : null;

        if (itemUnit !== 'measured') {
          return false;
        }

        const existingConverted = convertToBaseUnit(
          item.size_amount ?? 0,
          itemSizeUnit
        );

        return (
          !!existingConverted &&
          existingConverted.unit === incomingConverted.unit
        );
      });

      if (measuredMatch) {
        const existingSizeUnit = measuredMatch.size_unit
          ? normalizeUnit(measuredMatch.size_unit)
          : null;

        const existingConverted = convertToBaseUnit(
          measuredMatch.size_amount ?? 0,
          existingSizeUnit
        );

        if (!existingConverted) {
          return null;
        }

        const totalBaseAmount =
          existingConverted.amount + incomingConverted.amount;

        const formatted = formatAmountForDisplay(
          totalBaseAmount,
          incomingConverted.unit
        );

        const { data: updatedItem, error: updateError } = await this.supabase
          .from('pantry_items')
          .update({
            size_amount: formatted.amount,
            size_unit: formatted.unit,
            updated_at: new Date().toISOString(),
          })
          .eq('id', measuredMatch.id)
          .eq('space_id', spaceId)
          .select()
          .single();

        if (updateError) {
          console.error('Error merging measured pantry item during update:', updateError);
          return null;
        }

        const { error: deleteError } = await this.supabase
          .from('pantry_items')
          .delete()
          .eq('id', itemId)
          .eq('space_id', spaceId);

        if (deleteError) {
          console.error('Error deleting merged pantry item during update:', deleteError);
          return null;
        }

        return updatedItem as PantryItem;
      }

      const formatted = formatAmountForDisplay(
        incomingConverted.amount,
        incomingConverted.unit
      );

      const { data: updatedItem, error } = await this.supabase
        .from('pantry_items')
        .update({
          name: trimmedName,
          normalized_name: normalizedName,
          amount: 1,
          unit: 'measured',
          size_amount: formatted.amount,
          size_unit: formatted.unit,
          expiry_date: payload.expiry_date,
          updated_at: new Date().toISOString(),
        })
        .eq('id', itemId)
        .eq('space_id', spaceId)
        .select()
        .single();

      if (error) {
        console.error('Error updating measured pantry item:', error);
        return null;
      }

      return updatedItem as PantryItem;
    }

    const exactMatch = (existingItems ?? []).find((item) => {
      const itemUnit = item.unit?.trim() || 'item';
      const itemSizeUnit = item.size_unit ? normalizeUnit(item.size_unit) : null;

      return (
        itemUnit !== 'measured' &&
        item.size_amount === payload.size_amount &&
        itemSizeUnit === normalizedSizeUnit
      );
    });

    if (exactMatch) {
      const { data: updatedItem, error: updateError } = await this.supabase
        .from('pantry_items')
        .update({
          amount: exactMatch.amount + payload.amount,
          updated_at: new Date().toISOString(),
        })
        .eq('id', exactMatch.id)
        .eq('space_id', spaceId)
        .select()
        .single();

      if (updateError) {
        console.error('Error merging countable pantry item during update:', updateError);
        return null;
      }

      const { error: deleteError } = await this.supabase
        .from('pantry_items')
        .delete()
        .eq('id', itemId)
        .eq('space_id', spaceId);

      if (deleteError) {
        console.error('Error deleting merged countable pantry item during update:', deleteError);
        return null;
      }

      return updatedItem as PantryItem;
    }

    const { data: updatedItem, error } = await this.supabase
      .from('pantry_items')
      .update({
        name: trimmedName,
        normalized_name: normalizedName,
        amount: payload.amount,
        unit: normalizedUnit,
        size_amount: payload.size_amount,
        size_unit: normalizedSizeUnit,
        expiry_date: payload.expiry_date,
        updated_at: new Date().toISOString(),
      })
      .eq('id', itemId)
      .eq('space_id', spaceId)
      .select()
      .single();

    if (error) {
      console.error('Error updating pantry item:', error);
      return null;
    }

    return updatedItem as PantryItem;
  }

  async updatePantryItemAmount(
    itemId: string,
    amount: number
  ): Promise<boolean> {
    const spaceId = this.spaceStateService.getCurrentSpace()?.id;

    if (!spaceId) {
      return false;
    }

    const { error } = await this.supabase
      .from('pantry_items')
      .update({ amount })
      .eq('id', itemId)
      .eq('space_id', spaceId);

    if (error) {
      console.error('Error updating pantry item amount:', error);
      return false;
    }

    return true;
  }

  async deletePantryItem(itemId: string): Promise<boolean> {
    const spaceId = this.spaceStateService.getCurrentSpace()?.id;
    if (!spaceId) {
      return false;
    }
    const { error } = await this.supabase
      .from('pantry_items')
      .delete()
      .eq('id', itemId)
      .eq('space_id', spaceId);
    if (error) {
      console.error('Error deleting pantry item:', error);
      return false;
    }
    return true;
  }

  async deletePantryItems(itemIds: string[]): Promise<boolean> {
    const spaceId = this.spaceStateService.getCurrentSpace()?.id;
    if (!spaceId || itemIds.length === 0) {
      return false;
    }
    const { error } = await this.supabase
      .from('pantry_items')
      .delete()
      .eq('space_id', spaceId)
      .in('id', itemIds);
    if (error) {
      console.error('Error deleting pantry items:', error);
      return false;
    }
    return true;
  }

  async addOrIncrementPantryItem(name: string): Promise<PantryItem | null> {
    const spaceId = this.spaceStateService.getCurrentSpace()?.id;
    const trimmedName = name.trim();
    if (!trimmedName || !spaceId) {
      return null;
    }
    const normalizedName = this.normalizeName(trimmedName);
    const { data: existing, error: fetchError } = await this.supabase
      .from('pantry_items')
      .select('*')
      .eq('normalized_name', normalizedName)
      .eq('space_id', spaceId)
      .maybeSingle();
    if (fetchError) {
      console.error('Error checking existing pantry item:', fetchError);
      return null;
    }
    if (existing) {
      const { data, error } = await this.supabase
        .from('pantry_items')
        .update({
          amount: existing.amount + 1,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .eq('space_id', spaceId)
        .select()
        .single();

      if (error) {
        console.error('Error incrementing pantry item:', error);
        return null;
      }
      return data as PantryItem;
    }
    const { data, error } = await this.supabase
      .from('pantry_items')
      .insert([
        {
          name: trimmedName,
          normalized_name: normalizedName,
          amount: 1,
          unit: 'item',
          size_amount: null,
          size_unit: null,
          space_id: spaceId,
        },
      ])
      .select()
      .single();
    if (error) {
      console.error('Error creating pantry item:', error);
      return null;
    }
    return data as PantryItem;
  }

  async addFromMoveToPantry(payload: any): Promise<
    | 'added'
    | 'skipped_always_present'
    | 'skipped_existing_inferred'
    | 'failed'
  > {
    try {

      const spaceId = this.spaceStateService.getCurrentSpace()?.id;
      const trimmedName = payload.name.trim();

      if (!spaceId || !trimmedName) {
        return 'failed';
      }

      const normalizedName = this.normalizeName(trimmedName);

      const { data: alwaysPresent, error: alwaysPresentError } = await this.supabase
        .from('always_present_items')
        .select('id')
        .eq('space_id', spaceId)
        .eq('normalized_name', normalizedName)
        .maybeSingle();

      if (alwaysPresentError) {
        console.error('Error checking always present item:', alwaysPresentError);
        return 'failed';
      }

      if (alwaysPresent) {
        return 'skipped_always_present';
      }
      const existingItems = await this.getPantryItems();

      const normalizedPayloadName = normalizedName;

      const existingMatch = existingItems.find((item) => {
        const normalizedItemName = this.normalizeName(item.name);

        if (normalizedItemName !== normalizedPayloadName) {
          return false;
        }

        if (payload.unit === 'measured') {
          return (
            item.unit === 'measured' &&
            item.size_unit === payload.size_unit
          );
        }

        return (
          item.unit === 'item' &&
          (item.size_amount || null) === (payload.size_amount || null) &&
          (item.size_unit || null) === (payload.size_unit || null)
        );
      });

      const rememberedMerged =
        await this.applyRememberedCountableWordMergeIfPossible({
          name: payload.name,
          amount: payload.amount,
          unit: payload.unit,
          size_amount: payload.size_amount,
          size_unit: payload.size_unit,
          expiry_date: payload.expiry_date,
        });

      if (rememberedMerged) {
        return 'added';
      }

      if (payload.isInferredFromList) {
        if (existingMatch) {
          return 'skipped_existing_inferred';
        }

        await this.createPantryItem({
          ...payload,
          amount: 1,
        });

        return 'added';
      }

      await this.createPantryItem(payload);

      return 'added';
    } catch (error) {
      console.error('addFromMoveToPantry failed:', error);
      return 'failed';
    }
  }

  private sortPantryItems(items: PantryItem[]): PantryItem[] {
    return [...items].sort((a, b) => {
      const aKey = getIngredientSortKey(a.name);
      const bKey = getIngredientSortKey(b.name);

      const nameCompare = aKey.localeCompare(bKey);

      if (nameCompare !== 0) {
        return nameCompare;
      }

      if (a.unit === 'measured' && b.unit !== 'measured') return -1;
      if (a.unit !== 'measured' && b.unit === 'measured') return 1;

      const aUnit = a.size_unit ?? '';
      const bUnit = b.size_unit ?? '';

      const unitCompare = aUnit.localeCompare(bUnit);

      if (unitCompare !== 0) {
        return unitCompare;
      }

      return (a.size_amount ?? 0) - (b.size_amount ?? 0);
    });
  }

  private normalizeName(name: string): string {
    return name.trim().toLowerCase();
  }

  async getAlwaysPresentItems(spaceId: string): Promise<AlwaysPresentPantryItem[]> {
    const { data, error } = await this.supabaseService.supabase
      .from('always_present_items')
      .select(`
      id,
      name,
      normalized_name,
      created_at
    `)
      .eq('space_id', spaceId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching always present items:', error);
      return [];
    }

    return (data ?? []).map((item) => ({
      id: item.id,
      name: item.name,
      normalized_name: item.normalized_name,
      created_at: item.created_at,
    }));
  }

  async addAlwaysPresentItem(name: string): Promise<AlwaysPresentPantryItem | null> {
    const spaceId = this.spaceStateService.getCurrentSpace()?.id;
    const trimmedName = name.trim();

    if (!trimmedName || !spaceId) {
      return null;
    }

    const normalizedName = this.normalizeName(trimmedName);

    const { data, error } = await this.supabase
      .from('always_present_items')
      .insert([
        {
          name: trimmedName,
          normalized_name: normalizedName,
          space_id: spaceId,
        },
      ])
      .select()
      .single();

    if (error) {
      console.error('Error creating always present item:', error);
      return null;
    }

    return data as AlwaysPresentPantryItem;
  }

  async deleteAlwaysPresentItem(itemId: string): Promise<boolean> {
    const spaceId = this.spaceStateService.getCurrentSpace()?.id;

    if (!spaceId) {
      return false;
    }

    const { error } = await this.supabase
      .from('always_present_items')
      .delete()
      .eq('id', itemId)
      .eq('space_id', spaceId);

    if (error) {
      console.error('Error deleting always present item:', error);
      return false;
    }

    return true;
  }

  async applyRememberedCountableWordMergeIfPossible(payload: {
    name: string;
    amount: number;
    unit: string;
    size_amount: number | null;
    size_unit: string | null;
    expiry_date: string | null;
  }): Promise<PantryItem | null> {
    const spaceId = this.spaceStateService.getCurrentSpace()?.id;

    if (
      !spaceId ||
      payload.unit === 'measured' ||
      payload.size_amount ||
      payload.size_unit
    ) {
      return null;
    }

    const pantryItems = await this.getPantryItems();

    const rawIngredients = pantryItems
      .filter((item) => item.unit !== 'measured')
      .filter((item) => !item.size_amount && !item.size_unit)
      .map((item) => {
        const amount = Number(item.amount ?? 1);
        return amount > 1 ? `${amount} ${item.name}` : item.name;
      });

    const incomingAmount = Number(payload.amount ?? 1);

    rawIngredients.push(
      incomingAmount > 1
        ? `${incomingAmount} ${payload.name}`
        : payload.name
    );

    const candidates = detectPossibleMergeCandidatesFromRawIngredients(rawIngredients);

    if (!candidates.length) {
      return null;
    }

    const rules = await this.ingredientRulesService.getWordRules(spaceId);
    const lowerName = payload.name.trim().toLowerCase();

    const rememberedCandidate = candidates.find((candidate) => {
      const singular = candidate.singularText.trim().toLowerCase();
      const plural = candidate.pluralText.trim().toLowerCase();

      const matchesIncoming =
        singular === lowerName || plural === lowerName;

      const isRemembered = rules.some((rule) => {
        const ruleSingular = rule.singular_text.trim().toLowerCase();
        const rulePlural = rule.plural_text.trim().toLowerCase();

        return ruleSingular === singular && rulePlural === plural;
      });

      return matchesIncoming && isRemembered;
    });

    if (!rememberedCandidate) {
      return null;
    }

    const singularName = rememberedCandidate.singularText.trim().toLowerCase();
    const pluralName = rememberedCandidate.pluralText.trim().toLowerCase();

    const matchingItems = pantryItems.filter((item) =>
      item.unit !== 'measured' &&
      !item.size_amount &&
      !item.size_unit &&
      (
        item.name.trim().toLowerCase() === singularName ||
        item.name.trim().toLowerCase() === pluralName
      )
    );

    const existingAmount = matchingItems.reduce(
      (sum, item) => sum + Number(item.amount ?? 1),
      0
    );

    const totalAmount = existingAmount + incomingAmount;

    const targetPluralItem =
      matchingItems.find((item) => item.name.trim().toLowerCase() === pluralName) ??
      null;

    let affectedItem: PantryItem | null = null;

    if (targetPluralItem) {
      const success = await this.updatePantryItemAmount(
        targetPluralItem.id,
        totalAmount
      );

      if (!success) {
        return null;
      }

      affectedItem = {
        ...targetPluralItem,
        amount: totalAmount,
      };
    } else {
      affectedItem = await this.createPantryItem({
        name: pluralName,
        amount: totalAmount,
        unit: 'item',
        size_amount: null,
        size_unit: null,
        expiry_date: payload.expiry_date,
      });
    }

    if (!affectedItem) {
      return null;
    }

    for (const item of matchingItems) {
      if (item.id !== affectedItem.id) {
        await this.deletePantryItem(item.id);
      }
    }

    return affectedItem;
  }

  async applyRememberedCountableWordMergeForEditIfPossible(
    itemId: string,
    payload: {
      name: string;
      amount: number;
      unit: string;
      size_amount: number | null;
      size_unit: string | null;
      expiry_date: string | null;
    }
  ): Promise<PantryItem | null> {
    const spaceId = this.spaceStateService.getCurrentSpace()?.id;

    if (
      !spaceId ||
      payload.unit === 'measured' ||
      payload.size_amount ||
      payload.size_unit
    ) {
      return null;
    }

    const pantryItems = await this.getPantryItems();

    const rawIngredients = pantryItems
      .filter((item) => item.id !== itemId)
      .filter((item) => item.unit !== 'measured')
      .filter((item) => !item.size_amount && !item.size_unit)
      .map((item) => {
        const amount = Number(item.amount ?? 1);
        return amount > 1 ? `${amount} ${item.name}` : item.name;
      });

    const incomingAmount = Number(payload.amount ?? 1);

    rawIngredients.push(
      incomingAmount > 1
        ? `${incomingAmount} ${payload.name}`
        : payload.name
    );

    const candidates = detectPossibleMergeCandidatesFromRawIngredients(rawIngredients);
    const rules = await this.ingredientRulesService.getWordRules(spaceId);
    const lowerName = payload.name.trim().toLowerCase();

    const rememberedCandidate = candidates.find((candidate) => {
      const singular = candidate.singularText.trim().toLowerCase();
      const plural = candidate.pluralText.trim().toLowerCase();

      const matchesIncoming = singular === lowerName || plural === lowerName;

      const isRemembered = rules.some((rule) => {
        const ruleSingular = rule.singular_text.trim().toLowerCase();
        const rulePlural = rule.plural_text.trim().toLowerCase();

        return ruleSingular === singular && rulePlural === plural;
      });

      return matchesIncoming && isRemembered;
    });

    if (!rememberedCandidate) {
      return null;
    }

    const singularName = rememberedCandidate.singularText.trim().toLowerCase();
    const pluralName = rememberedCandidate.pluralText.trim().toLowerCase();

    const matchingItems = pantryItems.filter((item) =>
      item.id !== itemId &&
      item.unit !== 'measured' &&
      !item.size_amount &&
      !item.size_unit &&
      (
        item.name.trim().toLowerCase() === singularName ||
        item.name.trim().toLowerCase() === pluralName
      )
    );

    const existingAmount = matchingItems.reduce(
      (sum, item) => sum + Number(item.amount ?? 1),
      0
    );

    const totalAmount = existingAmount + incomingAmount;

    const targetPluralItem =
      matchingItems.find((item) => item.name.trim().toLowerCase() === pluralName) ??
      null;

    let affectedItem: PantryItem | null = null;

    if (targetPluralItem) {
      const success = await this.updatePantryItemAmount(
        targetPluralItem.id,
        totalAmount
      );

      if (!success) {
        return null;
      }

      await this.deletePantryItem(itemId);

      affectedItem = {
        ...targetPluralItem,
        amount: totalAmount,
      };
    } else {
      affectedItem = await this.updatePantryItem(itemId, {
        name: pluralName,
        amount: totalAmount,
        unit: 'item',
        size_amount: null,
        size_unit: null,
        expiry_date: payload.expiry_date,
      });
    }

    if (!affectedItem) {
      return null;
    }

    for (const item of matchingItems) {
      if (item.id !== affectedItem.id) {
        await this.deletePantryItem(item.id);
      }
    }

    return affectedItem;
  }

}