import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { GroceryList } from '../models/grocery-list.model';
import { SpaceStateService } from './space.state.service';

@Injectable({
  providedIn: 'root',
})
export class GroceryService {
  constructor(private supabaseService: SupabaseService, private spaceStateService: SpaceStateService) { }

  get supabase() {
    return this.supabaseService.supabase;
  }

  async getGroceryLists(): Promise<GroceryList[]> {
    const spaceId = this.spaceStateService.getCurrentSpace()?.id;
    const { data, error } = await this.supabaseService.supabase
      .from('grocery_lists')
      .select('*')
      .eq('space_id', spaceId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching grocery lists:', error);
      return [];
    }

    return (data ?? []) as GroceryList[];
  }

  async getGroceryListById(id: string): Promise<GroceryList | null> {
    const spaceId = this.spaceStateService.getCurrentSpace()?.id;
    const { data, error } = await this.supabaseService.supabase
      .from('grocery_lists')
      .select('*')
      .eq('id', id)
      .eq('space_id', spaceId)
      .single();

    if (error) {
      console.error('Error fetching grocery list by id:', error);
      return null;
    }

    return data as GroceryList;
  }

  async createGroceryList(
    name: string,
    createdByMemberId: number
  ): Promise<GroceryList | null> {
    const spaceId = this.spaceStateService.getCurrentSpace()?.id;
    const trimmedName = name.trim();

    if (!trimmedName) {
      return null;
    }

    const { data, error } = await this.supabaseService.supabase
      .from('grocery_lists')
      .insert([
        {
          name: trimmedName,
          status: 'active',
          created_by_member_id: createdByMemberId,
          space_id: spaceId,
        },
      ])
      .select()
      .single();

    if (error) {
      console.error('Error creating grocery list:', error);
      return null;
    }

    return data as GroceryList;
  }

  async updateGroceryListName(
    listId: string,
    newName: string
  ): Promise<boolean> {
    const spaceId = this.spaceStateService.getCurrentSpace()?.id;
    const trimmedName = newName.trim();

    if (!trimmedName) {
      return false;
    }

    const { error } = await this.supabase
      .from('grocery_lists')
      .update({ name: trimmedName })
      .eq('id', listId)
      .eq('space_id', spaceId);

    if (error) {
      console.error('Error updating grocery list:', error);
      return false;
    }

    return true;
  }

  async updateGroceryListStatus(
    listId: string,
    status: 'active' | 'completed' | 'archived'
  ): Promise<boolean> {
    const spaceId = this.spaceStateService.getCurrentSpace()?.id;
    const { error } = await this.supabase
      .from('grocery_lists')
      .update({ status })
      .eq('id', listId)
      .eq('space_id', spaceId);

    if (error) {
      console.error('Error updating grocery list status:', error);
      return false;
    }

    return true;
  }

  async updateGroceryListPinned(
    listId: string,
    isPinned: boolean
  ): Promise<boolean> {
    const spaceId = this.spaceStateService.getCurrentSpace()?.id;
    const { error } = await this.supabase
      .from('grocery_lists')
      .update({ is_pinned: isPinned })
      .eq('id', listId)
      .eq('space_id', spaceId);

    if (error) {
      console.error('Error updating grocery list pinned state:', error);
      return false;
    }

    return true;
  }

  async deleteGroceryList(listId: string): Promise<boolean> {
    const spaceId = this.spaceStateService.getCurrentSpace()?.id;
    const { error } = await this.supabase
      .from('grocery_lists')
      .delete()
      .eq('id', listId)
      .eq('space_id', spaceId);

    if (error) {
      console.error('Error deleting grocery list:', error);
      return false;
    }

    return true;
  }

  async getItemsByListId(listId: string): Promise<any[]> {
    const { data, error } = await this.supabaseService.supabase
      .from('grocery_list_items')
      .select(`
        *,
        addedBy:members!grocery_list_items_added_by_member_id_fkey (
          id,
          name,
          avatar_url
        ),
        boughtBy:members!grocery_list_items_bought_by_member_id_fkey (
          id,
          name,
          avatar_url
        )
      `)
      .eq('grocery_list_id', listId)
      .order('created_at', { ascending: true })
      .order('id', { ascending: true });

    if (error) {
      console.error('Error fetching grocery items:', error);
      return [];
    }

    return data ?? [];
  }

  async createGroceryItem(
    listId: string,
    name: string,
    addedByMemberId: number
  ): Promise<any | null> {
    const trimmedName = name.trim();

    if (!trimmedName) {
      return null;
    }

    const { data, error } = await this.supabaseService.supabase
      .from('grocery_list_items')
      .insert([
        {
          grocery_list_id: listId,
          name: trimmedName,
          status: 'needed',
          added_by_member_id: addedByMemberId,
        },
      ])
      .select()
      .single();

    if (error) {
      console.error('Error creating grocery item:', error);
      return null;
    }

    return data;
  }

  async updateGroceryItemStatus(
    itemId: string,
    status: 'needed' | 'bought',
    boughtByMemberId?: number
  ): Promise<boolean> {
    const payload =
      status === 'bought'
        ? {
          status,
          bought_by_member_id: boughtByMemberId ?? null,
          bought_at: new Date().toISOString(),
        }
        : {
          status,
          bought_by_member_id: null,
          bought_at: null,
        };

    const { error } = await this.supabaseService.supabase
      .from('grocery_list_items')
      .update(payload)
      .eq('id', itemId);

    if (error) {
      console.error('Error updating grocery item status:', error);
      return false;
    }

    return true;
  }

  async updateGroceryItemName(
    itemId: string,
    newName: string
  ): Promise<boolean> {
    const trimmedName = newName.trim();

    if (!trimmedName) {
      return false;
    }

    const { error } = await this.supabase
      .from('grocery_list_items')
      .update({ name: trimmedName })
      .eq('id', itemId);

    if (error) {
      console.error('Error updating grocery item name:', error);
      return false;
    }

    return true;
  }

  async deleteGroceryItem(itemId: string): Promise<boolean> {
    const { error } = await this.supabase
      .from('grocery_list_items')
      .delete()
      .eq('id', itemId);

    if (error) {
      console.error('Error deleting grocery item:', error);
      return false;
    }

    return true;
  }

  async updateGroceryItemMovedToPantry(
    itemId: string,
    value: boolean
  ): Promise<boolean> {
    const { error } = await this.supabase
      .from('grocery_list_items')
      .update({ moved_to_pantry: value })
      .eq('id', itemId);

    if (error) {
      console.error('Error updating moved_to_pantry:', error);
      return false;
    }

    return true;
  }


}