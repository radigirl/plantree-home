import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, HostListener, OnInit } from '@angular/core';
import { Observable } from 'rxjs';

import { Member } from '../../models/member.model';
import { Space } from '../../models/space.model';

import { SupabaseService } from '../../services/supabase.service';
import { MemberStateService } from '../../services/member.state.service';
import { SpaceStateService } from '../../services/space.state.service';
import { AvatarMenuComponent } from '../avatar-menu/avatar-menu.component';
import { Check, LucideAngularModule } from 'lucide-angular';
import { SpaceDialogComponent } from '../../features/spaces/space-dialog/space-dialog.component';
import { TranslatePipe } from '../pipes/translate.pipe';
import { MemberDialogComponent, MemberDialogSaveValue } from '../../features/members/member-dialog/member-dialog.component';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [
    CommonModule,
    AvatarMenuComponent,
    LucideAngularModule,
    TranslatePipe,
    SpaceDialogComponent,
    MemberDialogComponent,
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
  spaceDialogInitialName = '';

  isMemberDialogOpen = false;
  memberDialogInitialName = '';
  memberDialogInitialAvatarUrl: string | null = null;

  get orderedSpaces(): Space[] {
    const currentSpace = this.spaceStateService.getCurrentSpace();
    if (!currentSpace) {
      return this.spaces;
    }
    return [
      currentSpace,
      ...this.spaces.filter((space) => space.id !== currentSpace.id),
    ];
  }

  constructor(
    private supabaseService: SupabaseService,
    private memberStateService: MemberStateService,
    private spaceStateService: SpaceStateService,
    private cdr: ChangeDetectorRef
  ) {
    this.currentMember$ = this.memberStateService.currentMember$;
    this.currentSpace$ = this.spaceStateService.currentSpace$;
  }

  async ngOnInit(): Promise<void> {
    await this.memberStateService.loadMembers();
    await this.spaceStateService.loadSpaces();

    this.memberStateService.members$.subscribe((members) => {
      this.members = members;
      this.cdr.detectChanges();
    });

    this.spaceStateService.spaces$.subscribe((spaces) => {
      this.spaces = spaces;
      this.cdr.detectChanges();
    });

    const currentMember = this.memberStateService.getCurrentMember();
    if (!currentMember && this.members.length > 0) {
      this.memberStateService.setCurrentMember(this.members[1]); // TODO: handle this better when auth is implemented
    }

    const currentSpace = this.spaceStateService.getCurrentSpace();
    if (!currentSpace && this.spaces.length > 0) {
      this.spaceStateService.setCurrentSpace(this.spaces[0]); // TODO: handle this better when auth is implemented
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
    this.spaceDialogInitialName = '';
    this.isSpaceDialogOpen = true;
  }

  closeSpaceDialog(): void {
    this.isSpaceDialogOpen = false;
    this.spaceDialogInitialName = '';
  }

  async onSpaceDialogSave(name: string): Promise<void> {
    this.closeSpaceDialog();
    await this.spaceStateService.createSpace(name);
  }

  onAddMemberFromMenu(): void {
    this.memberDialogInitialName = '';
    this.memberDialogInitialAvatarUrl = null;
    this.isMemberDialogOpen = true;
  }

  closeMemberDialog(): void {
    this.isMemberDialogOpen = false;
    this.memberDialogInitialName = '';
    this.memberDialogInitialAvatarUrl = null;
  }

  async onMemberDialogSave(value: MemberDialogSaveValue): Promise<void> {
    const created = await this.memberStateService.createMember(
      value.name,
      value.avatarFile
    );
    if (!created) {
      console.error('Could not create member');
      return;
    }
    await this.memberStateService.loadMembers();
    this.closeMemberDialog();
    this.cdr.detectChanges();
  }

}