import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { Member } from '../models/member.model';
import { SupabaseService } from './supabase.service';
import { LanguageStateService } from './language.state.service';

export type AppLanguage = 'en' | 'bg';

@Injectable({
  providedIn: 'root',
})
export class MemberStateService {
  private currentMemberSubject = new BehaviorSubject<Member | null>(null);
  currentMember$ = this.currentMemberSubject.asObservable();

  constructor(
    private supabaseService: SupabaseService,
    private languageStateService: LanguageStateService
  ) { }

  setCurrentMember(member: Member): void {
    this.currentMemberSubject.next(member);
    this.applyMemberLanguage(member);
  }

  getCurrentMember(): Member | null {
    return this.currentMemberSubject.value;
  }

  async setCurrentMemberLanguage(language: AppLanguage): Promise<void> {
    const currentMember = this.getCurrentMember();

    this.languageStateService.setLanguage(language);

    if (!currentMember?.id) {
      console.warn('No current member id, skipping DB update');
      return;
    }

    const { data, error } = await this.supabaseService.supabase
      .from('members')
      .update({ preferred_language: language })
      .eq('id', String(currentMember.id))
      .select()
      .maybeSingle();

    if (error) {
      console.error('Failed to update member language', error);
      throw error;
    }

    this.currentMemberSubject.next(data as Member);
  }

  private applyMemberLanguage(member: Member | null): void {
    if (!member) return;

    const lang: AppLanguage = member.preferred_language || 'en';
    this.languageStateService.setLanguage(lang);
  }
}