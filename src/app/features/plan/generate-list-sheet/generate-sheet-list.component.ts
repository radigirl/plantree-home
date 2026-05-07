import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, OnChanges, SimpleChanges } from '@angular/core';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { LanguageStateService } from '../../../services/language.state.service';

export interface GenerateListMealItem {
  id: string;
  name: string;
  checked?: boolean;
  isCovered: boolean;
  coveredListName: string | null;
}

export interface GenerateListDayItem {
  key: string;
  label: string;
  date: string;
  isToday?: boolean;
  isPast?: boolean;
  meals: GenerateListMealItem[];
}

export interface GenerateListSelection {
  selectedDayKeys: string[];
  selectedMealIds: string[];
}

interface GenerateListDayState extends GenerateListDayItem {
  checked: boolean;
  expanded: boolean;
  meals: GenerateListMealItem[];
}

@Component({
  selector: 'app-generate-sheet-list',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  templateUrl: './generate-sheet-list.component.html',
  styleUrls: ['./generate-sheet-list.component.scss'],
})
export class GenerateSheetListComponent implements OnChanges {
  @Input() isOpen = false;
  @Input() title?: string;
  @Input() subtitle?: string;
  @Input() days: GenerateListDayItem[] = [];

  @Output() closed = new EventEmitter<void>();
  @Output() quickGenerate = new EventEmitter<void>();
  @Output() generateSelected = new EventEmitter<GenerateListSelection>();

  isAdjusting = false;
  dayStates: GenerateListDayState[] = [];

  constructor(private languageStateService: LanguageStateService) { }

  get sheetTitle(): string {
    return this.title || this.languageStateService.t('generateSheet.title');
  }

  get sheetSubtitle(): string {
    return this.subtitle || this.languageStateService.t('generateSheet.subtitle');
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['days']) {
      this.initializeState();
    }

    if (changes['isOpen'] && this.isOpen) {
      this.isAdjusting = false;
      this.initializeState();
    }
  }

  get daysWithMeals(): GenerateListDayState[] {
    return this.dayStates.filter((day) => day.meals.length > 0);
  }

  get hasMeals(): boolean {
    return this.daysWithMeals.length > 0;
  }

  get selectedDaysCount(): number {
    return this.dayStates.filter((day) => day.checked && this.hasCheckedMeals(day)).length;
  }

  get selectedMealsCount(): number {
    return this.dayStates.reduce((count, day) => {
      return count + day.meals.filter((meal) => meal.checked && !meal.isCovered).length;
    }, 0);
  }

  get coveredMealsCount(): number {
    return this.dayStates.reduce((count, day) => {
      return count + day.meals.filter((meal) => meal.isCovered).length;
    }, 0);
  }

  get allMealsCovered(): boolean {
    return this.selectedMealsCount === 0 && this.coveredMealsCount > 0;
  }

  openAdjust(): void {
    this.isAdjusting = true;
  }

  close(): void {
    this.closed.emit();
  }

  onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.close();
    }
  }

  onQuickGenerate(): void {
    this.quickGenerate.emit();
  }

  toggleDay(day: GenerateListDayState): void {
    const nextChecked = !day.checked;

    day.meals = day.meals.map((meal) => ({
      ...meal,
      checked: meal.isCovered ? false : nextChecked,
    }));

    day.checked = day.meals.some((meal) => meal.checked);
  }

  toggleDayExpanded(day: GenerateListDayState): void {
    day.expanded = !day.expanded;
  }

  toggleMeal(day: GenerateListDayState, mealId: string): void {
    const targetMeal = day.meals.find((meal) => meal.id === mealId);

    // Guard: do nothing if covered
    if (targetMeal?.isCovered) {
      return;
    }

    day.meals = day.meals.map((meal) =>
      meal.id === mealId ? { ...meal, checked: !meal.checked } : meal
    );

    day.checked = day.meals.some((meal) => meal.checked);
  }

  onGenerateSelected(): void {
    const selectedDayKeys = this.dayStates
      .filter((day) => day.meals.some((meal) => meal.checked && !meal.isCovered))
      .map((day) => day.key);

    const selectedMealIds = this.dayStates.flatMap((day) =>
      day.meals
        .filter((meal) => meal.checked && !meal.isCovered)
        .map((meal) => meal.id)
    );

    this.generateSelected.emit({
      selectedDayKeys,
      selectedMealIds,
    });
  }

  private initializeState(): void {
    this.dayStates = (this.days || [])
      .filter((day) => day.meals?.length > 0)
      .map((day) => {
        const defaultSelected = !day.isPast;

        const meals = (day.meals || []).map((meal) => ({
          ...meal,
          checked: defaultSelected && !meal.isCovered,
        }));

        return {
          ...day,
          checked: meals.some((meal) => meal.checked),
          expanded: false,
          meals,
        };
      });
  }

  private hasCheckedMeals(day: GenerateListDayState): boolean {
    return day.meals.some((meal) => meal.checked && !meal.isCovered);
  }
}