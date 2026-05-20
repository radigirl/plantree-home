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

  private membersSubject = new BehaviorSubject<Member[]>([]);
  members$ = this.membersSubject.asObservable();

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

  getCurrentMembers(): Member[] {
    return this.membersSubject.value;
  }

  async loadMembers(): Promise<Member[]> {
    const members = await this.supabaseService.getMembers();
    this.membersSubject.next(members);
    return members;
  }

  async getMembers(): Promise<Member[]> {
    return this.loadMembers();
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

  private async uploadMemberAvatar(file: File): Promise<string | null> {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;
    const filePath = `member-avatars/${fileName}`;

    const { error } = await this.supabaseService.supabase.storage
      .from('member-avatars')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (error) {
      console.error('Error uploading member avatar:', error);
      return null;
    }

    const { data } = this.supabaseService.supabase.storage
      .from('member-avatars')
      .getPublicUrl(filePath);

    return data.publicUrl;
  }

  async createMember(
    name: string,
    avatarFile?: File | null
  ): Promise<Member | null> {
    const trimmedName = name.trim();

    if (!trimmedName) {
      return null;
    }

    let avatarUrl: string | null = null;

    if (avatarFile) {
      avatarUrl = await this.uploadMemberAvatar(avatarFile);
    }

    const { data, error } = await this.supabaseService.supabase
      .from('members')
      .insert([
        {
          name: trimmedName,
          avatar_url: avatarUrl,
        },
      ])
      .select()
      .single();

    if (error) {
      console.error('Error creating member:', error);
      return null;
    }

    await this.loadMembers();

    return data as Member;
  }

  async updateMember(
    memberId: number,
    name: string,
    avatarFile?: File | null,
    removeAvatar = false
  ): Promise<Member | null> {
    const trimmedName = name.trim();

    if (!trimmedName) {
      return null;
    }

    const payload: {
      name: string;
      avatar_url?: string | null;
    } = {
      name: trimmedName,
    };

    if (removeAvatar) {
      payload.avatar_url = null;
    }
    if (avatarFile) {
      const avatarUrl = await this.uploadMemberAvatar(avatarFile);
      if (avatarUrl) {
        payload.avatar_url = avatarUrl;
      }
    }

    const { data, error } = await this.supabaseService.supabase
      .from('members')
      .update(payload)
      .eq('id', memberId)
      .select()
      .single();

    if (error) {
      console.error('Error updating member:', error);
      return null;
    }

    await this.loadMembers();

    if (this.getCurrentMember()?.id === memberId) {
      this.setCurrentMember(data as Member);
    }

    return data as Member;
  }

  private applyMemberLanguage(member: Member | null): void {
    if (!member) return;

    const lang: AppLanguage = member.preferred_language || 'en';
    this.languageStateService.setLanguage(lang);
  }
}