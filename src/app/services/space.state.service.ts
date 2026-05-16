import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

import { Space } from '../models/space.model';
import { SupabaseService } from './supabase.service';

@Injectable({
  providedIn: 'root'
})
export class SpaceStateService {
  private currentSpaceSubject = new BehaviorSubject<Space | null>(null);

  currentSpace$ = this.currentSpaceSubject.asObservable();

  constructor(
    private supabaseService: SupabaseService
  ) { }

  setCurrentSpace(space: Space): void {
    this.currentSpaceSubject.next(space);
  }

  getCurrentSpace(): Space | null {
    return this.currentSpaceSubject.value;
  }

  async getSpaces(): Promise<Space[]> {
    return this.supabaseService.getSpaces();
  }

  async createSpace(name: string): Promise<Space | null> {
    return this.supabaseService.createSpace(name);
  }

  async updateSpaceName(spaceId: string, name: string): Promise<Space | null> {
    const updated = await this.supabaseService.updateSpaceName(spaceId, name);
    if (updated && this.getCurrentSpace()?.id === spaceId) {
      this.setCurrentSpace(updated);
    }
    return updated;
  }
}