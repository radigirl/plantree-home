import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';

export interface PantryItem {
  id: string;
  name: string;
  normalized_name: string;
  amount: number;
  unit: string;
  size_amount: number | null;
  size_unit: string | null;
  created_at: string;
  updated_at: string;
}

@Injectable({
  providedIn: 'root',
})
export class PantryService {
  constructor(private supabaseService: SupabaseService) {}

  get supabase() {
    return this.supabaseService.supabase;
  }

  async getPantryItems(): Promise<PantryItem[]> {
    const { data, error } = await this.supabase
      .from('pantry_items')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching pantry items:', error);
      return [];
    }

    return (data ?? []) as PantryItem[];
  }

  async createPantryItem(name: string): Promise<PantryItem | null> {
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
      .eq('id', itemId);

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
    const { error } = await this.supabase
      .from('pantry_items')
      .update({ amount })
      .eq('id', itemId);

    if (error) {
      console.error('Error updating pantry item amount:', error);
      return false;
    }

    return true;
  }

  async deletePantryItem(itemId: string): Promise<boolean> {
    const { error } = await this.supabase
      .from('pantry_items')
      .delete()
      .eq('id', itemId);

    if (error) {
      console.error('Error deleting pantry item:', error);
      return false;
    }

    return true;
  }

  async addOrIncrementPantryItem(name: string): Promise<PantryItem | null> {
    const trimmedName = name.trim();

    if (!trimmedName) {
      return null;
    }

    const normalizedName = this.normalizeName(trimmedName);

    const { data: existing, error: fetchError } = await this.supabase
      .from('pantry_items')
      .select('*')
      .eq('normalized_name', normalizedName)
      .limit(1)
      .maybeSingle();

    if (fetchError) {
      console.error('Error checking existing pantry item:', fetchError);
      return null;
    }

    if (existing) {
      const nextAmount = (existing.amount ?? 0) + 1;

      const { data, error } = await this.supabase
        .from('pantry_items')
        .update({
          amount: nextAmount,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .select()
        .single();

      if (error) {
        console.error('Error incrementing pantry item:', error);
        return null;
      }

      return data as PantryItem;
    }

    return this.createPantryItem(trimmedName);
  }

  private normalizeName(name: string): string {
    return name.trim().toLowerCase();
  }
}