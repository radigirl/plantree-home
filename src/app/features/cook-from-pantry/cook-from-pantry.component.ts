import {
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject } from 'rxjs';
import {
  distinctUntilChanged,
  filter,
  takeUntil,
} from 'rxjs/operators';

import { PageLoadingComponent } from '../../shared/components/page-loading/page-loading.component';
import { MealsService } from '../../services/meal.service';
import { PantryService } from '../../services/pantry.service';
import { SpaceStateService } from '../../services/space.state.service';
import { MemberStateService } from '../../services/member.state.service';

import { Meal } from '../../models/meal.model';
import { PantryItem } from '../../models/pantry-item.model';
import { AlwaysPresentPantryItem } from '../../models/always-present-pantry-item.model';
import {
  ResponsiveActionMenuComponent,
  ResponsiveActionMenuItem,
} from '../../shared/components/responsive-action-menu/responsive-action-menu';
import { isIngredientMatch } from '../../shared/utils/ingredient-match.util';
import { MealPlanService } from '../../services/meal-plan.service';
import { CalendarPickerComponent } from '../../shared/components/calendar-picker/calendar-picker.component';

type EmptyState =
  | 'none'
  | 'no-meals'
  | 'empty-pantry'
  | 'both-empty';

interface CookFromPantryMeal extends Meal {
  score: number;
  matchedCount: number;
  totalCount: number;
}

@Component({
  selector: 'app-cook-from-pantry',
  standalone: true,
  imports: [
    CommonModule,
    PageLoadingComponent,
    ResponsiveActionMenuComponent,
    CalendarPickerComponent
  ],
  templateUrl: './cook-from-pantry.component.html',
  styleUrl: './cook-from-pantry.component.scss',
})
export class CookFromPantryComponent
  implements OnInit, OnDestroy {
  isLoading = true;
  emptyState: EmptyState = 'none';

  sortedMeals: CookFromPantryMeal[] = [];

  private destroy$ = new Subject<void>();

  isActionMenuOpen = false;
  selectedMeal: CookFromPantryMeal | null = null;

  selectedMealForInfo: CookFromPantryMeal | null = null;

  availableItems: (PantryItem | AlwaysPresentPantryItem)[] = [];

  actionMenuItems: ResponsiveActionMenuItem[] = [
    { id: 'today', label: 'Today' },
    { id: 'tomorrow', label: 'Tomorrow' },
    { id: 'pick-date', label: 'Pick a date' },
  ];

  isAddToPlanLoading = false;

  isPickDateOpen = false;
  calendarSelectionMode: 'single' | 'multiple' = 'single';
  selectedPlanDates: string[] = [];

  toastMessage: string | null = null;
  toastTimeout: any = null;


  constructor(
    private mealsService: MealsService,
    private pantryService: PantryService,
    private spaceStateService: SpaceStateService,
    private mealPlanService: MealPlanService,
    private memberStateService: MemberStateService,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    this.spaceStateService.currentSpace$
      .pipe(
        takeUntil(this.destroy$),
        filter((space): space is NonNullable<typeof space> => !!space),
        distinctUntilChanged((prev, curr) => prev.id === curr.id)
      )
      .subscribe(async (space) => {
        await this.loadSuggestions(space.id);
      });
  }

  private async loadSuggestions(spaceId: string): Promise<void> {
    this.isLoading = true;
    this.emptyState = 'none';
    this.sortedMeals = [];
    this.availableItems = [];

    try {
      const currentMember =
        this.memberStateService.getCurrentMember();

      if (!currentMember) {
        this.isLoading = false;
        this.cdr.detectChanges();
        return;
      }

      const [allMeals, pantryItems, alwaysPresentItems] =
        await Promise.all([
          this.mealsService.getAllMeals(),
          this.pantryService.getPantryItems(),
          this.pantryService.getAlwaysPresentItems(spaceId),
        ]);

      const availableItems = [...pantryItems, ...alwaysPresentItems];
      this.availableItems = availableItems;

      const hasMeals = allMeals.length > 0;
      const hasPantry = availableItems.length > 0;

      if (!hasMeals && !hasPantry) {
        this.emptyState = 'both-empty';
      } else if (!hasMeals) {
        this.emptyState = 'no-meals';
      } else if (!hasPantry) {
        this.emptyState = 'empty-pantry';
      } else {
        this.sortedMeals = this.buildSortedMeals(
          allMeals,
          pantryItems,
          alwaysPresentItems
        );
      }
    } catch (error) {
      console.error(
        'Error loading cook from pantry suggestions:',
        error
      );
      this.emptyState = 'both-empty';
      this.sortedMeals = [];
    } finally {
      this.isLoading = false;
      this.cdr.detectChanges();
    }
  }

  private buildSortedMeals(
    meals: Meal[],
    pantryItems: PantryItem[],
    alwaysPresentItems: AlwaysPresentPantryItem[]
  ): CookFromPantryMeal[] {
    return meals
      .map((meal) => {
        const normalizedIngredients = (meal.ingredients ?? [])
          .map((ingredient) =>
            ingredient.trim().toLowerCase()
          )
          .filter(Boolean);

        const totalCount = normalizedIngredients.length;

        if (totalCount === 0) {
          return null;
        }

        let matchedCount = 0;
        let realMatchedCount = 0;

        normalizedIngredients.forEach((ingredient) => {
          const isRealMatch = pantryItems.some((item) =>
            isIngredientMatch(item.normalized_name || '', ingredient)
          );

          const isAlwaysMatch = alwaysPresentItems.some((item) =>
            isIngredientMatch(item.normalized_name || '', ingredient)
          );

          if (isRealMatch || isAlwaysMatch) {
            matchedCount++;
          }

          if (isRealMatch) {
            realMatchedCount++;
          }
        });

        // meal must have at least 1 real pantry match
        if (realMatchedCount === 0) {
          return null;
        }

        return {
          ...meal,
          score: matchedCount / totalCount,
          matchedCount,
          totalCount,
        };
      })
      .filter((meal): meal is CookFromPantryMeal => meal !== null)
      .sort((a, b) => b.score - a.score);
  }

  isIngredientAvailable(ingredient: string): boolean {
    return this.availableItems.some((item) =>
      isIngredientMatch(item.normalized_name || '', ingredient)
    );
  }

  openAddMenu(meal: CookFromPantryMeal): void {
    this.selectedMeal = meal;
    this.isActionMenuOpen = true;
  }

  closeActionMenu(): void {
    this.isActionMenuOpen = false;
    this.selectedMeal = null;
  }

  async onActionSelected(actionId: string): Promise<void> {
    if (!this.selectedMeal || this.isAddToPlanLoading) {
      return;
    }

    switch (actionId) {
      case 'today':
        await this.handleAddToPlanSelection('today');
        break;

      case 'tomorrow':
        await this.handleAddToPlanSelection('tomorrow');
        break;

      case 'pick-date':
        this.openPickDateMode();
        break;

      default:
        break;
    }
  }

  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private async handleAddToPlanSelection(
    action: 'today' | 'tomorrow'
  ): Promise<void> {
    if (!this.selectedMeal || this.isAddToPlanLoading) {
      return;
    }

    const meal = this.selectedMeal;

    const date = new Date();
    if (action === 'tomorrow') {
      date.setDate(date.getDate() + 1);
    }

    const formattedDate = this.formatDate(date);
    const label = action === 'today' ? 'Today' : 'Tomorrow';

    this.isAddToPlanLoading = true;

    try {
      await this.mealPlanService.createPlannedMealFromExistingMeal(
        meal.id,
        null,
        formattedDate
      );

      this.closeActionMenu();
      this.showToast(`${meal.name} added to ${label}`);
    } catch (error) {
      console.error('Failed to add meal:', error);
      this.closeActionMenu();
      this.showToast('Failed to add meal');
    } finally {
      this.isAddToPlanLoading = false;
    }
  }

  openPickDateMode(): void {
    this.isPickDateOpen = true;
    this.resetCalendarSelection();
    this.isActionMenuOpen = false;
  }

  onCalendarDatesChange(dates: string[]): void {
    this.selectedPlanDates = dates;
  }

  async confirmPickedDates(dates: string[]): Promise<void> {
    if (!this.selectedMeal || !dates.length) {
      return;
    }

    const meal = this.selectedMeal;
    this.isAddToPlanLoading = true;

    try {
      for (const date of dates) {
        await this.mealPlanService.createPlannedMealFromExistingMeal(
          meal.id,
          null,
          date
        );
      }

      this.resetCalendarSelection();
      this.isPickDateOpen = false;
      this.selectedMeal = null;

      this.showToast(
        dates.length === 1
          ? `${meal.name} added to ${this.formatToastDayLabel(dates[0])}`
          : `${meal.name} added to ${dates.length} days`
      );
    } catch (error) {
      console.error('Failed to add meal:', error);
      this.isPickDateOpen = false;
      this.selectedMeal = null;
      this.showToast('Failed to add meal');
    } finally {
      this.isAddToPlanLoading = false;
    }
  }

  closePickDate(): void {
    this.isPickDateOpen = false;
    this.resetCalendarSelection();
    this.selectedMeal = null;
  }

  private showToast(message: string): void {
    this.toastMessage = message;
    this.cdr.detectChanges();

    if (this.toastTimeout) {
      clearTimeout(this.toastTimeout);
    }

    this.toastTimeout = setTimeout(() => {
      this.toastMessage = null;
      this.cdr.detectChanges();
    }, 2500);
  }

  private formatToastDayLabel(dateString: string): string {
    const date = new Date(`${dateString}T12:00:00`);
    return date.toLocaleDateString('en-US', { weekday: 'long' });
  }

  private resetCalendarSelection(): void {
    this.selectedPlanDates = [];
    this.calendarSelectionMode = 'single';
  }

  openInfoSheet(event: Event, meal: CookFromPantryMeal): void {
    event.stopPropagation();
    this.selectedMealForInfo = meal;
  }

  closeInfoSheet(): void {
    this.selectedMealForInfo = null;
  }

  onAddFromInfo(): void {
  if (!this.selectedMealForInfo) {
    return;
  }

  this.selectedMeal = this.selectedMealForInfo;
  this.selectedMealForInfo = null;
  this.isActionMenuOpen = true;
}

  ngOnDestroy(): void {
    this.destroy$.next();
    if (this.toastTimeout) {
      clearTimeout(this.toastTimeout);
    }
    this.destroy$.complete();
  }
}