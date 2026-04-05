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

  async createPantryItem(name: string): Promise<PantryItem | null> {

    const spaceId =  this.spaceStateService.getCurrentSpace()?.id;
    const trimmedName = name.trim();

    if (!trimmedName) {
      return null;
    }

    const normalizedName = this.normalizeName(trimmedName);

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

  async updatePantryItemName(
    itemId: string,
    newName: string
  ): Promise<boolean> {
    const spaceId =  this.spaceStateService.getCurrentSpace()?.id;
    const trimmedName = newName.trim();

    if (!trimmedName) {
      return false;
    }

    const { error } = await this.supabase
      .from('pantry_items')
      .update({
        name: trimmedName,
        normalized_name: this.normalizeName(trimmedName),
      })
      .eq('id', itemId)
      .eq('space_id', spaceId);

    if (error) {
      console.error('Error updating pantry item name:', error);
      return false;
    }

    return true;
  }

  async updatePantryItemAmount(
    itemId: string,
    amount: number
  ): Promise<boolean> {
    const spaceId = this.spaceStateService.getCurrentSpace()?.id;

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
    const spaceId =  this.spaceStateService.getCurrentSpace()?.id;
    const trimmedName = name.trim();

    if (!trimmedName) {
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

  
}