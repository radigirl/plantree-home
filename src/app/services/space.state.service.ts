import { BehaviorSubject } from "rxjs";
import { Space } from "../models/space.model";
import { SupabaseService } from "./supabase.service";
import { Injectable } from "@angular/core";

@Injectable({
  providedIn: 'root'
})
export class SpaceStateService {
  private currentSpaceSubject = new BehaviorSubject<Space | null>(null);
  currentSpace$ = this.currentSpaceSubject.asObservable();

  private spacesSubject = new BehaviorSubject<Space[]>([]);
  spaces$ = this.spacesSubject.asObservable();

  constructor(private supabaseService: SupabaseService) { }

  setCurrentSpace(space: Space): void {
    this.currentSpaceSubject.next(space);
  }

  getCurrentSpace(): Space | null {
    return this.currentSpaceSubject.value;
  }

  getCurrentSpaces(): Space[] {
    return this.spacesSubject.value;
  }

  async loadSpaces(): Promise<Space[]> {
    const spaces = await this.supabaseService.getSpaces();
    this.spacesSubject.next(spaces);
    return spaces;
  }

  async getSpaces(): Promise<Space[]> {
    return this.loadSpaces();
  }

  async createSpace(name: string): Promise<Space | null> {
    const created = await this.supabaseService.createSpace(name);

    if (created) {
      await this.loadSpaces();
    }

    return created;
  }

  async updateSpaceName(spaceId: string, name: string): Promise<Space | null> {
    const updated = await this.supabaseService.updateSpaceName(spaceId, name);
    if (updated) {
      await this.loadSpaces();
      if (this.getCurrentSpace()?.id === spaceId) {
        this.setCurrentSpace(updated);
      }
    }
    return updated;
  }

  async resetSpace(spaceId: string): Promise<boolean> {
    const { error } = await this.supabaseService.supabase.rpc(
      'reset_space_data',
      { target_space_id: spaceId }
    );
    if (error) {
      console.error('Error resetting space:', error);
      return false;
    }
    return true;
  }

  async deleteSpace(spaceId: string): Promise<{
    success: boolean;
    switchedToSpace: Space | null;
  }> {
    const currentSpace = this.getCurrentSpace();
    const wasCurrentSpace = currentSpace?.id === spaceId;

    const { error } = await this.supabaseService.supabase.rpc(
      'delete_space',
      { target_space_id: spaceId }
    );

    if (error) {
      console.error('Error deleting space:', error);
      return {
        success: false,
        switchedToSpace: null,
      };
    }

    await this.loadSpaces();

    if (!wasCurrentSpace) {
      return {
        success: true,
        switchedToSpace: null,
      };
    }

    const remainingSpaces = [...this.spacesSubject.value].sort(
      (a, b) =>
        new Date(b.created_at).getTime() -
        new Date(a.created_at).getTime()
    );

    const newestSpace = remainingSpaces[0] ?? null;

    if (newestSpace) {
      this.setCurrentSpace(newestSpace);
    }

    return {
      success: true,
      switchedToSpace: newestSpace,
    };
  }
}