import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { PantryItem } from '../models/pantry-item.model';
import { SpaceStateService } from './space.state.service';
import { AlwaysPresentPantryItem } from '../models/always-present-pantry-item.model';

@Injectable({
  providedIn: 'root',
})
export class PantryService {
  constructor(private supabaseService: SupabaseService, private spaceStateService: SpaceStateService) { }

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

    return (data ?? []) as PantryItem[];
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
    const normalizedSizeUnit = payload.size_unit?.trim() || null;

    const { data: existingItems, error: fetchError } = await this.supabase
      .from('pantry_items')
      .select('*')
      .eq('space_id', spaceId)
      .eq('normalized_name', normalizedName);

    if (fetchError) {
      console.error('Error checking existing pantry item:', fetchError);
      return null;
    }

    // measured → merge by name + measured + size unit, and add size_amount
    if (normalizedUnit === 'measured') {
      const measuredMatch = (existingItems ?? []).find((item) => {
        const itemUnit = item.unit?.trim() || 'item';
        const itemSizeUnit = item.size_unit?.trim() || null;

        return itemUnit === 'measured' && itemSizeUnit === normalizedSizeUnit;
      });

      if (measuredMatch) {
        const currentSizeAmount = measuredMatch.size_amount ?? 0;
        const incomingSizeAmount = payload.size_amount ?? 0;

        const { data, error } = await this.supabase
          .from('pantry_items')
          .update({
            size_amount: currentSizeAmount + incomingSizeAmount,
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

      const { data, error } = await this.supabase
        .from('pantry_items')
        .insert([
          {
            name: trimmedName,
            normalized_name: normalizedName,
            amount: 1,
            unit: 'measured',
            size_amount: payload.size_amount,
            size_unit: normalizedSizeUnit,
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
      const itemSizeUnit = item.size_unit?.trim() || null;

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
  ): Promise<boolean> {
    const spaceId = this.spaceStateService.getCurrentSpace()?.id;

    const trimmedName = payload.name.trim();

    if (!trimmedName || !spaceId) {
      return false;
    }

    const updateData: any = {
      name: trimmedName,
      normalized_name: this.normalizeName(trimmedName),
      amount: payload.amount,
      unit: payload.unit,
      size_amount: payload.size_amount,
      size_unit: payload.size_unit,
      expiry_date: payload.expiry_date,
    };

    const { error } = await this.supabase
      .from('pantry_items')
      .update(updateData)
      .eq('id', itemId)
      .eq('space_id', spaceId);

    if (error) {
      console.error('Error updating pantry item:', error);
      return false;
    }

    return true;
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
}