import { Injectable } from '@angular/core';
import { createClient } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';
import { FamilyMember } from '../models/family-member.model';

@Injectable({
  providedIn: 'root'
})
export class SupabaseService {
  supabase = createClient(
    environment.supabaseUrl,
    environment.supabaseKey
  );

  async getUsers(): Promise<FamilyMember[]> {
    const { data, error } = await this.supabase
      .from('users')
      .select('*')
      .order('id', { ascending: true });

    if (error) {
      console.error('Supabase error:', error);
      return [];
    }

    return (data ?? []) as FamilyMember[];
  }
}