import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, OnChanges, SimpleChanges } from '@angular/core';

export interface GenerateListMealItem {
  id: string;
  name: string;
  checked?: boolean;
}

export interface GenerateListDayItem {
  key: string;
  label: string;   // Mon
  date: string;    // 11 Apr
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
  meals: Array<GenerateListMealItem & { checked: boolean }>;
}

@Component({
  selector: 'app-generate-sheet-list',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './generate-sheet-list.component.html',
  styleUrls: ['./generate-sheet-list.component.scss'],
})
export class GenerateSheetListComponent implements OnChanges {
  @Input() isOpen = false;
  @Input() title = 'Generate grocery list';
  @Input() subtitle = 'Create a list from meals in this week';
  @Input() days: GenerateListDayItem[] = [];

  @Output() closed = new EventEmitter<void>();
  @Output() quickGenerate = new EventEmitter<void>();
  @Output() generateSelected = new EventEmitter<GenerateListSelection>();

  isAdjusting = false;
  dayStates: GenerateListDayState[] = [];

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
      return count + day.meals.filter((meal) => meal.checked).length;
    }, 0);
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
    day.checked = !day.checked;
    day.meals = day.meals.map((meal) => ({
      ...meal,
      checked: day.checked,
    }));
  }

  toggleDayExpanded(day: GenerateListDayState): void {
    day.expanded = !day.expanded;
  }

  toggleMeal(day: GenerateListDayState, mealId: string): void {
    day.meals = day.meals.map((meal) =>
      meal.id === mealId ? { ...meal, checked: !meal.checked } : meal
    );

    day.checked = day.meals.some((meal) => meal.checked);
  }

  onGenerateSelected(): void {
    const selectedDayKeys = this.dayStates
      .filter((day) => day.meals.some((meal) => meal.checked))
      .map((day) => day.key);

    const selectedMealIds = this.dayStates.flatMap((day) =>
      day.meals.filter((meal) => meal.checked).map((meal) => meal.id)
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

        return {
          ...day,
          checked: defaultSelected,
          expanded: false,
          meals: (day.meals || []).map((meal) => ({
            ...meal,
            checked: defaultSelected,
          })),
        };
      });
  }

  private hasCheckedMeals(day: GenerateListDayState): boolean {
    return day.meals.some((meal) => meal.checked);
  }
}