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

  constructor(private supabaseService: SupabaseService) {}

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
}