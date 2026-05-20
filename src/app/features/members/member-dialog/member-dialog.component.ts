import { CommonModule } from '@angular/common';
import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { LucideAngularModule, UserRound } from 'lucide-angular';

export interface MemberDialogSaveValue {
  name: string;
  avatarFile: File | null;
  removeAvatar: boolean;
}

@Component({
  selector: 'app-member-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe, LucideAngularModule],
  templateUrl: './member-dialog.component.html',
  styleUrl: './member-dialog.component.scss',
})
export class MemberDialogComponent implements OnChanges {
  @Input() isOpen = false;
  @Input() mode: 'add' | 'edit' = 'add';
  @Input() initialName = '';
  @Input() initialAvatarUrl: string | null | undefined = null;
  @Input() membersCount = 0;

  @Output() closed = new EventEmitter<void>();
  @Output() saved = new EventEmitter<MemberDialogSaveValue>();
  @Output() deleteMember = new EventEmitter<void>();

  name = '';
  selectedAvatarFile: File | null = null;
  selectedAvatarPreview: string | null = null;
  removeAvatar = false;

  isSaving = false;

  readonly userIcon = UserRound;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isOpen'] || changes['initialName'] || changes['initialAvatarUrl'] || changes['mode']) {
      this.name = this.initialName ?? '';
      this.selectedAvatarFile = null;
      this.selectedAvatarPreview = this.initialAvatarUrl ?? null;
      this.removeAvatar = false;
      this.isSaving = false;
    }
  }

  close(): void {
    this.closed.emit();
  }

  save(): void {
    if (this.isSaving) {
      return;
    }

    const trimmedName = this.name.trim();

    if (!trimmedName) {
      return;
    }

    this.isSaving = true;

    this.saved.emit({
      name: trimmedName,
      avatarFile: this.selectedAvatarFile,
      removeAvatar: this.removeAvatar,
    });
  }

  onAvatarSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;

    if (!file) {
      return;
    }

    this.selectedAvatarFile = file;
    this.selectedAvatarPreview = URL.createObjectURL(file);
    this.removeAvatar = false;
  }

  removeSelectedAvatar(): void {
    this.selectedAvatarFile = null;
    this.selectedAvatarPreview = null;
    this.removeAvatar = true;
  }

  onDeleteMember(): void {
    console.log('Delete member clicked from dialog');
    this.deleteMember.emit();
  }
}