import { CommonModule } from '@angular/common';
import { Component, HostListener, OnInit } from '@angular/core';
import { LucideAngularModule, User } from 'lucide-angular';
import { Observable } from 'rxjs';

import { Member } from '../../models/member.model';
import { Space } from '../../models/space.model';

import { SupabaseService } from '../../services/supabase.service';
import { MemberStateService } from '../../services/member.state.service';
import { SpaceStateService } from '../../services/space.state.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss',
})
export class HeaderComponent implements OnInit {
  readonly memberIcon = User;

  members: Member[] = [];
  spaces: Space[] = [];

  currentMember$: Observable<Member | null>;
  currentSpace$: Observable<Space | null>;

  isMemberMenuOpen = false;
  isSpaceMenuOpen = false;

  constructor(
    private supabaseService: SupabaseService,
    private memberStateService: MemberStateService,
    private spaceStateService: SpaceStateService
  ) {
    this.currentMember$ = this.memberStateService.currentMember$;
    this.currentSpace$ = this.spaceStateService.currentSpace$;
  }

  async ngOnInit(): Promise<void> {
    this.members = await this.supabaseService.getMembers();
    this.spaces = await this.supabaseService.getSpaces();

    const currentMember = this.memberStateService.getCurrentMember();
    if (!currentMember && this.members.length > 0) {
      this.memberStateService.setCurrentMember(this.members[1]); // TODO: handle this better when auth is implemented
    }

    const currentSpace = this.spaceStateService.getCurrentSpace();
    if (!currentSpace && this.spaces.length > 0) {
      this.spaceStateService.setCurrentSpace(this.spaces[1]); // TODO: handle this better when auth is implemented
    }
  }

  toggleMemberMenu(): void {
    this.isMemberMenuOpen = !this.isMemberMenuOpen;

    // close the other menu
    this.isSpaceMenuOpen = false;
  }

  selectMember(member: Member): void {
    this.memberStateService.setCurrentMember(member);
    this.isMemberMenuOpen = false;
  }

  toggleSpaceMenu(): void {
    this.isSpaceMenuOpen = !this.isSpaceMenuOpen;

    // close the other menu
    this.isMemberMenuOpen = false;
  }

  selectSpace(space: Space): void {
    this.spaceStateService.setCurrentSpace(space);
    this.isSpaceMenuOpen = false;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;

    if (!target.closest('.member-switcher')) {
      this.isMemberMenuOpen = false;
    }

    if (!target.closest('.space-switcher')) {
      this.isSpaceMenuOpen = false;
    }
  }
}