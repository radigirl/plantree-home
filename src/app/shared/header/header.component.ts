import { CommonModule } from '@angular/common';
import { Component, HostListener, OnInit } from '@angular/core';
import { Observable } from 'rxjs';

import { Member } from '../../models/member.model';
import { Space } from '../../models/space.model';

import { SupabaseService } from '../../services/supabase.service';
import { MemberStateService } from '../../services/member.state.service';
import { SpaceStateService } from '../../services/space.state.service';
import { AvatarMenuComponent } from '../avatar-menu/avatar-menu.component';
import { Check, LucideAngularModule } from 'lucide-angular';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, AvatarMenuComponent, LucideAngularModule],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss',
})
export class HeaderComponent implements OnInit {

  members: Member[] = [];
  spaces: Space[] = [];

  currentMember$: Observable<Member | null>;
  currentSpace$: Observable<Space | null>;

  isMemberMenuOpen = false;
  isSpaceMenuOpen = false;

  readonly checkIcon = Check;

  avatarCloseSignal = 0;

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

  selectMember(member: Member): void {
    this.memberStateService.setCurrentMember(member);
    this.isMemberMenuOpen = false;
  }

  toggleSpaceMenu(): void {
    this.isSpaceMenuOpen = !this.isSpaceMenuOpen;

    if (this.isSpaceMenuOpen) {
      this.avatarCloseSignal++;
    }
  }

  onAvatarMenuOpened(): void {
    this.isSpaceMenuOpen = false;
  }

  selectSpace(space: Space): void {
    this.spaceStateService.setCurrentSpace(space);
    this.isSpaceMenuOpen = false;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;

    if (!target.closest('.space-switcher')) {
      this.isSpaceMenuOpen = false;
    }
  }

  onAddSpace(): void {
    console.log('Add space clicked');
  }

}