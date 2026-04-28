import {
  Component,
  EventEmitter,
  Input,
  Output,
  OnChanges,
  SimpleChanges,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { Member } from '../../../models/member.model';
import { PlannedMeal } from '../../../models/planned-meal.model';

type DayMealFormMode = 'add' | 'edit-cook' | 'change-meal';

@Component({
  selector: 'app-day-meal-form-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './day-meal-form-dialog.component.html',
  styleUrl: './day-meal-form-dialog.component.scss',
})
export class DayMealFormDialogComponent implements OnChanges {
  @Input() isOpen = false;
  @Input() mode: DayMealFormMode = 'add';
  @Input() plannedMeal: PlannedMeal | null = null;
  @Input() availableMembers: Member[] = [];

  @Output() closed = new EventEmitter<void>();
  @Output() saved = new EventEmitter<{ mode: DayMealFormMode; cookId: number | null }>();

  isSaving = false;
  selectedCookId: number | null = null;

  ngOnChanges(changes: SimpleChanges): void {
  if (changes['isOpen'] && this.isOpen) {
    this.selectedCookId = this.plannedMeal?.cook?.id ?? null;
    this.isSaving = false;
  }

  if (changes['isOpen'] && !this.isOpen) {
    this.isSaving = false;
  }
}

  onOverlayClick(): void {
    this.onCancel();
  }

  onCancel(): void {
    this.closed.emit();
  }

  onSave(): void {
  this.saved.emit({
    mode: this.mode,
    cookId: this.selectedCookId,
  });
}

  getTitle(): string {
    switch (this.mode) {
      case 'edit-cook':
        return 'Edit cook';
      case 'change-meal':
        return 'Change meal';
      default:
        return 'Add meal';
    }
  }
}