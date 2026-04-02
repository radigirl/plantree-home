import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { Member } from '../models/member.model';

@Injectable({
  providedIn: 'root'
})
export class UserStateService {
  private currentUserSubject = new BehaviorSubject<Member | null>(null);
  currentUser$ = this.currentUserSubject.asObservable();

  setCurrentUser(member: Member): void {
    this.currentUserSubject.next(member);
  }

  getCurrentUser(): Member | null {
    return this.currentUserSubject.value;
  }
}