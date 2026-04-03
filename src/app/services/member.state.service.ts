import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { Member } from '../models/member.model';

@Injectable({
  providedIn: 'root'
})
export class MemberStateService {
  private currentMemberSubject = new BehaviorSubject<Member | null>(null);
  currentMember$ = this.currentMemberSubject.asObservable();

  setCurrentMember(member: Member): void {
    this.currentMemberSubject.next(member);
  }

  getCurrentMember(): Member | null {
    return this.currentMemberSubject.value;
  }
}