import {
  Component,
  EventEmitter,
  Input,
  Output,
  OnChanges,
  SimpleChanges,
  ElementRef,
  ViewChild,
  AfterViewChecked,
  ChangeDetectorRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { Member } from '../../../models/member.model';
import { PlannedMeal } from '../../../models/planned-meal.model';
import { Meal } from '../../../models/meal.model';
import { ToggleSwitchComponent } from '../../../shared/components/toggle-switch/toggle-switch.component';

type DayMealFormMode = 'add' | 'edit-cook' | 'change-meal';

@Component({
  selector: 'app-day-meal-form-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, ToggleSwitchComponent],
  templateUrl: './day-meal-form-dialog.component.html',
  styleUrl: './day-meal-form-dialog.component.scss',
})
export class DayMealFormDialogComponent implements OnChanges {
  @Input() isOpen = false;
  @Input() mode: DayMealFormMode = 'add';
  @Input() plannedMeal: PlannedMeal | null = null;
  @Input() availableMembers: Member[] = [];
  @Input() availableMeals: Meal[] = [];

  @Output() closed = new EventEmitter<void>();
  @Output() saved = new EventEmitter<{
    mode: DayMealFormMode;
    cookId: number | null;
    selectedMealId?: string | null;
    changeMealMode?: 'search' | 'create-from-current';
    addMealMode?: 'search' | 'new';

    newMealName?: string;
    newPrepTime?: number | null;
    mealIngredientsText?: string;
    mealInstructions?: string;
    selectedImageFile?: File | null;
    changeMealIngredientsText?: string;
    changeMealInstructions?: string;
    selectedMealIds?: string[];
  }>();

  isSaving = false;
  selectedCookId: number | null = null;
  changeMealMode: 'search' | 'create-from-current' = 'search';
  changeMealSearchQuery = '';
  selectedExistingMealId: string | null = null;
  selectedExistingMealIds: string[] = [];
  addMealMode: 'search' | 'new' = 'search';
  mealSearchQuery = '';
  newMealName = '';
  newPrepTime: number | null = null;
  mealIngredientsText = '';
  mealInstructions = '';
  selectedImageFile: File | null = null;
  selectedImagePreview: string | null = null;
  showAdvanced = false;
  changeMealIngredientsText = '';
  changeMealInstructions = '';
  showChangeAdvanced = false;
  formError = '';
  chipsExpanded = false;

  @ViewChild('selectedMealsChips') selectedMealsChips?: ElementRef<HTMLDivElement>;
  selectedMealsHasOverflow = false;

  constructor(private cdr: ChangeDetectorRef) { }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isOpen'] && this.isOpen) {
      this.selectedCookId = this.plannedMeal?.cook?.id ?? null;
      this.isSaving = false;

      this.selectedExistingMealId = null;
      this.selectedExistingMealIds = [];
      this.mealSearchQuery = '';
      this.changeMealSearchQuery = '';
      this.formError = '';

      if (this.mode === 'add') {
        this.addMealMode = this.availableMeals.length > 0 ? 'search' : 'new';
        this.newMealName = '';
        this.newPrepTime = null;
        this.mealIngredientsText = '';
        this.mealInstructions = '';
        this.selectedImageFile = null;
        this.selectedImagePreview = null;
        this.showAdvanced = false;
      }

      if (this.mode === 'change-meal') {
        this.changeMealMode = 'search';
        this.showChangeAdvanced = false;

        this.newMealName = this.plannedMeal?.meal?.name ?? '';
        this.newPrepTime = this.plannedMeal?.meal?.prepTime ?? null;
        this.selectedImagePreview = this.plannedMeal?.meal?.image_url ?? null;
        this.selectedImageFile = null;
        this.changeMealIngredientsText = (this.plannedMeal?.meal?.ingredients ?? []).join('\n');
        this.changeMealInstructions = this.plannedMeal?.meal?.instructions ?? '';
      }
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
    this.formError = '';
    if (this.isSaving) return;
    if (
      this.mode === 'change-meal' &&
      this.changeMealMode === 'search' &&
      !this.selectedExistingMealId
    ) {
      return;
    }
    if (this.mode === 'add' && this.addMealMode === 'search' && this.selectedExistingMealIds.length === 0) {
      return;
    }
    if (this.mode === 'add' && this.addMealMode === 'new' && !this.newMealName.trim()) {
      return;
    }
    if (
      this.mode === 'change-meal' &&
      this.changeMealMode === 'create-from-current' &&
      !this.newMealName.trim()
    ) {
      return;
    }
    if (
      this.mode === 'change-meal' &&
      this.changeMealMode === 'create-from-current' &&
      !this.hasCreateFromCurrentChanges
    ) {
      this.formError = 'Make at least one change before saving.';
      return;
    }
    this.isSaving = true;
    this.saved.emit({
      mode: this.mode,
      cookId: this.selectedCookId,
      selectedMealId: this.selectedExistingMealId,
      selectedMealIds: this.selectedExistingMealIds,
      changeMealMode: this.changeMealMode,
      addMealMode: this.addMealMode,

      newMealName: this.newMealName,
      newPrepTime: this.newPrepTime,
      mealIngredientsText: this.mealIngredientsText,
      mealInstructions: this.mealInstructions,
      selectedImageFile: this.selectedImageFile,
      changeMealIngredientsText: this.changeMealIngredientsText,
      changeMealInstructions: this.changeMealInstructions,
    });
  }

  get hasCreateFromCurrentChanges(): boolean {
    const meal = this.plannedMeal?.meal;
    if (!meal) return false;

    const originalIngredients = (meal.ingredients ?? []).join('\n').trim();
    const currentIngredients = this.changeMealIngredientsText.trim();

    return (
      this.newMealName.trim() !== (meal.name ?? '').trim() ||
      this.newPrepTime !== (meal.prepTime ?? null) ||
      currentIngredients !== originalIngredients ||
      this.changeMealInstructions.trim() !== (meal.instructions ?? '').trim() ||
      !!this.selectedImageFile
    );
  }

  getTitle(): string {
    switch (this.mode) {
      case 'edit-cook':
        return 'Change cook';
      case 'change-meal':
        return 'Change meal';
      default:
        return 'Add meal';
    }
  }

  get displayedChangeMealOptions(): Meal[] {
    const query = this.changeMealSearchQuery.trim().toLowerCase();

    if (!query) {
      return [];
    }

    return this.availableMeals.filter((meal) => {
      const nameMatch = meal.name?.toLowerCase().includes(query);

      const ingredientMatch = meal.ingredients?.some((ingredient) =>
        ingredient.toLowerCase().includes(query)
      );

      return nameMatch || ingredientMatch;
    });
  }

  get selectedChangeMeal(): Meal | null {
    if (!this.selectedExistingMealId) {
      return null;
    }

    return this.availableMeals.find((meal) => meal.id === this.selectedExistingMealId) ?? null;
  }

  setChangeMealMode(mode: string): void {
    if (mode !== 'search' && mode !== 'create-from-current') {
      return;
    }

    this.changeMealMode = mode;
    this.selectedExistingMealId = null;
    this.changeMealSearchQuery = '';
  }

  selectMealForChange(mealId: string): void {
    this.selectedExistingMealId = mealId;
    this.changeMealSearchQuery = '';
  }

  clearChangeMealSearch(): void {
    this.selectedExistingMealId = null;
    this.changeMealSearchQuery = '';
  }

  get displayedAvailableMeals(): Meal[] {
    const query = this.mealSearchQuery.trim().toLowerCase();
    if (!query) return [];

    return this.availableMeals.filter((meal) => {
      const nameMatch = meal.name?.toLowerCase().includes(query);
      const ingredientMatch = meal.ingredients?.some((ingredient) =>
        ingredient.toLowerCase().includes(query)
      );

      return nameMatch || ingredientMatch;
    });
  }

  setAddMealMode(mode: string): void {
    if (mode !== 'search' && mode !== 'new') return;

    this.addMealMode = mode;
    this.selectedExistingMealId = null;
    this.selectedExistingMealIds = [];
    this.mealSearchQuery = '';
  }


  get newMealHasDetails(): boolean {
    return !!(
      this.mealIngredientsText.trim() ||
      this.mealInstructions.trim()
    );
  }

  onMealImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;

    if (!file) {
      this.selectedImageFile = null;
      this.selectedImagePreview = null;
      return;
    }

    this.selectedImageFile = file;
    this.selectedImagePreview = URL.createObjectURL(file);
  }

  selectMealForAdd(mealId: string): void {
    if (this.selectedExistingMealIds.includes(mealId)) {
      this.selectedExistingMealIds = this.selectedExistingMealIds.filter((id) => id !== mealId);
      return;
    }

    this.selectedExistingMealIds = [...this.selectedExistingMealIds, mealId];
  }

  removeMealFromAddSelection(mealId: string): void {
    this.selectedExistingMealIds = this.selectedExistingMealIds.filter((id) => id !== mealId);
  }

  clearMealSearch(): void {
    this.selectedExistingMealIds = [];
    this.mealSearchQuery = '';
  }

  isMealSelectedForAdd(mealId: string): boolean {
    return this.selectedExistingMealIds.includes(mealId);
  }

  get selectedAvailableMeals(): Meal[] {
    return this.availableMeals.filter((meal) =>
      this.selectedExistingMealIds.includes(meal.id)
    );
  }

  removeSelectedMealImage(): void {
    this.selectedImageFile = null;
    this.selectedImagePreview = null;
  }

  ngAfterViewChecked(): void {
    this.updateSelectedMealsOverflow();
  }

  private updateSelectedMealsOverflow(): void {
  const element = this.selectedMealsChips?.nativeElement;

  if (!element) {
    this.selectedMealsHasOverflow = false;
    this.chipsExpanded = false;
    return;
  }

  if (this.chipsExpanded) {
    return;
  }

  const hasOverflow = element.scrollHeight > element.clientHeight + 1;

  if (this.selectedMealsHasOverflow !== hasOverflow) {
    this.selectedMealsHasOverflow = hasOverflow;
    this.cdr.detectChanges();
  }
}

  toggleChipsExpanded(): void {
    this.chipsExpanded = !this.chipsExpanded;
  }

}