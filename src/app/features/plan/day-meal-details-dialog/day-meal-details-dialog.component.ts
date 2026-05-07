import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule, Clock3, UserRound } from 'lucide-angular';

import { PlannedMeal } from '../../../models/planned-meal.model';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { LanguageStateService } from '../../../services/language.state.service';

@Component({
  selector: 'app-day-meal-details-dialog',
  standalone: true,
  imports: [CommonModule, LucideAngularModule, TranslatePipe],
  templateUrl: './day-meal-details-dialog.component.html',
  styleUrl: './day-meal-details-dialog.component.scss',
})
export class DayMealDetailsDialogComponent {
  @Input() isOpen = false;
  @Input() meal: PlannedMeal | null = null;
  @Input() isPast = false;
  @Input() coverageListName: string | null = null;

  @Output() closed = new EventEmitter<void>();
  @Output() primaryAction = new EventEmitter<PlannedMeal>();

  readonly Clock3 = Clock3;
  readonly UserRound = UserRound;

  constructor(
  private languageStateService: LanguageStateService
) {}

  onClose(): void {
    this.closed.emit();
  }

  onPrimaryAction(): void {
    if (!this.meal || this.isPast) return;
    this.primaryAction.emit(this.meal);
  }

  getStatusLabel(status: string): string {
  return this.languageStateService.t(`mealStatus.${status}`);
}

  getPrimaryActionLabel(status: string): string | null {
  switch (status) {
    case 'to-prepare':
      return this.languageStateService.t('dayDetails.startCooking');

    case 'in-progress':
      return this.languageStateService.t('dayDetails.markReady');

    case 'ready-to-serve':
      return this.languageStateService.t('dayDetails.reset');

    default:
      return null;
  }
}

  getPrimaryActionIcon(status: string): string {
    switch (status) {
      case 'to-prepare':
        return '▶';
      case 'in-progress':
        return '✔';
      case 'ready-to-serve':
  return '⟲';
      default:
        return '';
    }
  }
}