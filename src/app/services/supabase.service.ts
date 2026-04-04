import { Injectable } from '@angular/core';
import { createClient } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';
import { Member } from '../models/member.model';
import { Space } from '../models/space.model';

@Injectable({
  providedIn: 'root'
})
export class SupabaseService {
  supabase = createClient(
    environment.supabaseUrl,
    environment.supabaseKey
  );

  async getMembers(): Promise<Member[]> {
    const { data, error } = await this.supabase
      .from('members')
      .select('*')
      .order('id', { ascending: true });

    if (error) {
      console.error('Supabase error:', error);
      return [];
    }

    return (data ?? []) as Member[];
  }


  async getSpaces(): Promise<Space[]> {
    const { data, error } = await this.supabase
      .from('spaces')
      .select('*')
      .order('id', { ascending: true });

    if (error) {
      console.error('Supabase error:', error);
      return [];
    }

    return (data ?? []) as Space[];
  }

  async uploadMealImage(file: File, fileName: string): Promise<string> {
    const path = `meals/${fileName}`;

    const { error } = await this.supabase.storage
      .from('meal-images')
      .upload(path, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (error) {
      console.error('Error uploading meal image:', error);
      throw error;
    }

    return path;
  }

  getMealImageUrl(path: string | null | undefined): string | null {
    if (!path) {
      return null;
    }

    if (path.startsWith('assets/')) {
      return path;
    }

    const { data } = this.supabase.storage
      .from('meal-images')
      .getPublicUrl(path);

    return data.publicUrl;
  }

  async deleteMealImage(path: string): Promise<void> {
    if (!path.startsWith('meals/')) {
      return;
    }

    const { error } = await this.supabase.storage
      .from('meal-images')
      .remove([path]);

    if (error) {
      console.error('Error deleting image:', error);
      throw error;
    }
  }
}