import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { Space } from '../models/space.model';

@Injectable({
  providedIn: 'root'
})
export class SpaceStateService {
  private currentSpaceSubject = new BehaviorSubject<Space | null>(null);
  currentSpace$ = this.currentSpaceSubject.asObservable();

  setCurrentSpace(space: Space): void {
    this.currentSpaceSubject.next(space);
  }

  getCurrentSpace(): Space | null {
    return this.currentSpaceSubject.value;
  }
}