import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Meal } from '../../../models/meal.model';
import { CommonModule } from '@angular/common';
import { Clock3, LucideAngularModule } from 'lucide-angular';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { formatLocalizedIngredientDisplay } from '../../../shared/utils/measurement-style.util';
import { LanguageStateService } from '../../../services/language.state.service';

@Component({
  selector: 'app-meal-details-modal',
  standalone: true,
  imports: [CommonModule, LucideAngularModule, TranslatePipe],
  templateUrl: './meal-details-modal.component.html',
  styleUrls: ['./meal-details-modal.component.scss']
})
export class MealDetailsModalComponent {
  @Input() meal: Meal | null = null;
  @Input() isOpen = false;

  @Output() close = new EventEmitter<void>();

  readonly clock3Icon = Clock3;

  constructor(
    private languageStateService: LanguageStateService
  ) {}

  getDisplayIngredientName(ingredient: string): string {
    return formatLocalizedIngredientDisplay(
      ingredient,
      this.languageStateService.getLanguage()
    );
  }

  onClose(): void {
    this.close.emit();
  }
}