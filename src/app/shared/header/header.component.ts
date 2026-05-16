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
import { SpaceDialogComponent } from '../../features/spaces/space-dialog/space-dialog.component';
import { ManageSpacesDialogComponent } from '../../features/spaces/manage-space-dialog/manage-spaces-dialog.component';
import { TranslatePipe } from '../pipes/translate.pipe';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [
    CommonModule,
    AvatarMenuComponent,
    LucideAngularModule,
    TranslatePipe,
    SpaceDialogComponent,
    ManageSpacesDialogComponent,
  ],
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

  isSpaceDialogOpen = false;
  spaceDialogMode: 'add' | 'edit' = 'add';
  spaceDialogInitialName = '';
  selectedSpaceForEdit: Space | null = null;

  isManageSpacesDialogOpen = false;

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
    this.isSpaceMenuOpen = false;
    this.spaceDialogMode = 'add';
    this.spaceDialogInitialName = '';
    this.selectedSpaceForEdit = null;
    this.isSpaceDialogOpen = true;
  }

  closeSpaceDialog(): void {
    this.isSpaceDialogOpen = false;
    this.spaceDialogInitialName = '';
    this.selectedSpaceForEdit = null;
  }

  onSpaceDialogSave(name: string): void {
    console.log('Space dialog save:', {
      mode: this.spaceDialogMode,
      name,
      space: this.selectedSpaceForEdit,
    });

    this.closeSpaceDialog();
  }

  openManageSpacesDialog(): void {
    this.isSpaceMenuOpen = false;
    this.avatarCloseSignal++;
    this.isManageSpacesDialogOpen = true;
  }

  closeManageSpacesDialog(): void {
    this.isManageSpacesDialogOpen = false;
  }

  onManageAddSpace(): void {
    this.spaceDialogMode = 'add';
    this.spaceDialogInitialName = '';
    this.selectedSpaceForEdit = null;
    this.isSpaceDialogOpen = true;
  }

  onManageEditSpace(space: Space): void {
    this.spaceDialogMode = 'edit';
    this.spaceDialogInitialName = space.name;
    this.selectedSpaceForEdit = space;
    this.isSpaceDialogOpen = true;
  }

  onManageDeleteSpace(space: Space): void {
    console.log('Delete space clicked:', space);
  }

}