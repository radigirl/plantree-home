import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { Check, LucideAngularModule, UserRound } from 'lucide-angular';

import { Member } from '../../../models/member.model';
import { MemberStateService } from '../../../services/member.state.service';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { ConfirmationDialogComponent } from '../../../shared/components/confirmation-dialog/confirmation-dialog.component';
import { SnackbarComponent } from '../../../shared/components/snackbar/snackbar.component';
import { LanguageStateService } from '../../../services/language.state.service';
import {
  MemberDialogComponent,
  MemberDialogSaveValue,
} from '../member-dialog/member-dialog.component';

@Component({
  selector: 'app-manage-members-page',
  standalone: true,
  imports: [
    CommonModule,
    TranslatePipe,
    LucideAngularModule,
    MemberDialogComponent,
    ConfirmationDialogComponent,
    SnackbarComponent,
  ],
  templateUrl: './manage-members-page.component.html',
  styleUrl: './manage-members-page.component.scss',
})
export class ManageMembersPageComponent implements OnInit {
  members: Member[] = [];
  currentMember: Member | null = null;

  isMemberDialogOpen = false;
  memberDialogMode: 'add' | 'edit' = 'add';
  memberDialogInitialName = '';
  memberDialogInitialAvatarUrl: string | null | undefined = null;
  selectedMemberForEdit: Member | null = null;

  isDeleteConfirmOpen = false;

  toastMessage = '';
  isToastVisible = false;
  private toastTimeout: ReturnType<typeof setTimeout> | null = null;

  readonly checkIcon = Check;
  readonly userIcon = UserRound;

  constructor(
    private memberStateService: MemberStateService,
    private languageStateService: LanguageStateService,
    private cdr: ChangeDetectorRef
  ) { }

  async ngOnInit(): Promise<void> {
    this.memberStateService.members$.subscribe((members) => {
      this.members = members;
      this.cdr.detectChanges();
    });

    this.memberStateService.currentMember$.subscribe((member) => {
      this.currentMember = member;
      this.cdr.detectChanges();
    });

    await this.memberStateService.loadMembers();
  }

  async loadMembers(): Promise<void> {
    await this.memberStateService.loadMembers();
  }

  onAddMember(): void {
    this.memberDialogMode = 'add';
    this.memberDialogInitialName = '';
    this.memberDialogInitialAvatarUrl = null;
    this.selectedMemberForEdit = null;
    this.isMemberDialogOpen = true;
  }

  onEditMember(member: Member): void {
    this.memberDialogMode = 'edit';
    this.memberDialogInitialName = member.name;
    this.memberDialogInitialAvatarUrl = member.avatar_url;
    this.selectedMemberForEdit = member;
    this.isMemberDialogOpen = true;
  }

  closeMemberDialog(): void {
    this.isMemberDialogOpen = false;
    this.memberDialogInitialName = '';
    this.memberDialogInitialAvatarUrl = null;
    this.selectedMemberForEdit = null;
  }

  async onMemberDialogSave(value: MemberDialogSaveValue): Promise<void> {
    const mode = this.memberDialogMode;
    const selectedMember = this.selectedMemberForEdit;
    if (mode === 'add') {
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
      this.showToast(this.languageStateService.t('members.memberCreatedToast'));
      return;
    }

    if (mode === 'edit' && selectedMember) {
      const updated = await this.memberStateService.updateMember(
        selectedMember.id,
        value.name,
        value.avatarFile,
        value.removeAvatar
      );
      if (!updated) {
        console.error('Could not update member');
        return;
      }
      await this.memberStateService.loadMembers();
      if (this.currentMember?.id === updated.id) {
        this.memberStateService.setCurrentMember(updated);
      }
      this.closeMemberDialog();
      this.showToast(this.languageStateService.t('members.memberUpdatedToast'));
    }
  }

  onDeleteMemberFromDialog(): void {
    this.isDeleteConfirmOpen = true;
  }

  cancelMemberConfirm(): void {
    this.isDeleteConfirmOpen = false;
  }

  async confirmDeleteMember(): Promise<void> {
    const member = this.selectedMemberForEdit;

    if (!member) {
      return;
    }
    const result = await this.memberStateService.deleteMember(member);
    if (!result.success) {
      console.error('Could not delete member');
      this.isDeleteConfirmOpen = false;
      return;
    }
    this.isDeleteConfirmOpen = false;
    this.closeMemberDialog();
    if (result.switchedToMember) {
      this.showToast(
        `${this.languageStateService.t('members.memberDeletedToast')} · ${this.languageStateService.t('members.switchedTo')} ${result.switchedToMember.name}`
      );
    } else {
      this.showToast(this.languageStateService.t('members.memberDeletedToast'));
    }
  }

  showToast(message: string): void {
    this.toastMessage = message;
    this.isToastVisible = true;

    if (this.toastTimeout) {
      clearTimeout(this.toastTimeout);
    }

    this.toastTimeout = setTimeout(() => {
      this.isToastVisible = false;
      this.toastMessage = '';
      this.cdr.detectChanges();
    }, 3000);

    this.cdr.detectChanges();
  }
}