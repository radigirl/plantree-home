import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { FamilyMember } from '../models/family-member.model';

@Injectable({
  providedIn: 'root'
})
export class UserStateService {
  private currentUserSubject = new BehaviorSubject<FamilyMember | null>(null);
  currentUser$ = this.currentUserSubject.asObservable();

  setCurrentUser(user: FamilyMember): void {
    this.currentUserSubject.next(user);
  }

  getCurrentUser(): FamilyMember | null {
    return this.currentUserSubject.value;
  }
}