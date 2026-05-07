import {
  ChangeDetectorRef,
  Component,
  HostListener,
  OnDestroy,
  OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { Meal } from '../../models/meal.model';
import { MealsService } from '../../services/meal.service';
import { SupabaseService } from '../../services/supabase.service';
import { PageLoadingComponent } from '../../shared/components/page-loading/page-loading.component';
import { MemberStateService } from '../../services/member.state.service';
import { filterMealsByQuery } from '../../shared/utils/meal-search.util';
import { MealDetailsModalComponent } from './meal-details-modal/meal-details-modal.component';
import {
  ResponsiveActionMenuComponent,
  ResponsiveActionMenuItem,
} from '../../shared/components/responsive-action-menu/responsive-action-menu';
import { MealPlanService } from '../../services/meal-plan.service';
import { CalendarPickerComponent } from '../../shared/components/calendar-picker/calendar-picker.component';
import { Subject } from 'rxjs';
import { takeUntil, distinctUntilChanged } from 'rxjs/operators';
import { MealDialogComponent } from './meal-dialog/meal-dialog.component';
import { ConfirmationDialogComponent } from '../../shared/components/confirmation-dialog/confirmation-dialog.component';
import { SnackbarComponent } from '../../shared/components/snackbar/snackbar.component';
import { Clock3, LucideAngularModule } from 'lucide-angular';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';
import { LanguageStateService } from '../../services/language.state.service';

@Component({
  selector: 'app-meals',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    PageLoadingComponent,
    MealDetailsModalComponent,
    ResponsiveActionMenuComponent,
    CalendarPickerComponent,
    MealDialogComponent,
    ConfirmationDialogComponent,
    SnackbarComponent,
    LucideAngularModule,
    TranslatePipe
  ],
  templateUrl: './meals.component.html',
  styleUrl: './meals.component.scss',
})
export class MealsComponent implements OnInit, OnDestroy {
  meals: Meal[] = [];
  isLoading = true;
  isAddToPlanLoading = false;

  openMealMenuId: string | null = null;

  mealSearchQuery = '';
  selectedSearchMeal: Meal | null = null;
  isSearchMealDetailsOpen = false;

  selectedMealForActions: Meal | null = null;
  mealActionSheetMode: 'actions' | 'addToPlan' | 'pickDate' = 'actions';

  snackbarMessage: string | null = null;
  isSnackbarVisible = false;
  snackbarActionLabel: string | null = null;
  toastTimeout: ReturnType<typeof setTimeout> | null = null;

  calendarSelectionMode: 'single' | 'multiple' = 'single';
  selectedPlanDates: string[] = [];

  isDeleteDialogOpen = false;
  mealToDelete: Meal | null = null;

  isMealDialogOpen = false;
  mealDialogMode: 'create' | 'edit' | 'createFromExisting' = 'create';
  mealDialogInitialMeal: Meal | null = null;

  readonly clock3Icon = Clock3;

  private destroy$ = new Subject<void>();


  constructor(
    private mealsService: MealsService,
    private supabaseService: SupabaseService,
    private cdr: ChangeDetectorRef,
    private memberStateService: MemberStateService,
    private mealPlanService: MealPlanService,
    private languageStateService: LanguageStateService
  ) { }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement | null;

    if (!target) {
      return;
    }

    const clickedInsideMenu = target.closest('.meal-menu-wrapper');

    if (!clickedInsideMenu && !this.isMobileViewport()) {
      this.closeMealMenu();
    }
  }

  async ngOnInit(): Promise<void> {
    this.memberStateService.currentMember$
      .pipe(
        takeUntil(this.destroy$),
        distinctUntilChanged((prev, curr) => prev?.id === curr?.id)
      )
      .subscribe(async (member) => {
        this.resetMealsViewState();

        if (!member) {
          this.meals = [];
          this.isLoading = true;
          this.cdr.detectChanges();
          return;
        }

        await this.loadMeals(member.id);
      });
  }

  get mealActions(): ResponsiveActionMenuItem[] {
    return [
      { id: 'edit', label: this.languageStateService.t('meals.edit') },
      { id: 'create-from-this', label: this.languageStateService.t('meals.createFromThis') },
      { id: 'add-to-plan', label: this.languageStateService.t('meals.addToPlan') },
      { id: 'remove', label: this.languageStateService.t('meals.remove') },
    ];
  }

  async loadMeals(memberId: number): Promise<void> {
    this.isLoading = true;

    try {
      this.meals = await this.mealsService.getMeals(memberId);
    } catch (error) {
      console.error('Error loading meals:', error);
      this.meals = [];
    } finally {
      this.isLoading = false;
      this.cdr.detectChanges();
    }
  }

  private resetMealsViewState(): void {
    this.openMealMenuId = null;
    this.selectedMealForActions = null;
    this.selectedSearchMeal = null;
    this.isSearchMealDetailsOpen = false;
    this.mealSearchQuery = '';
    this.mealActionSheetMode = 'actions';
    this.resetCalendarSelection();
  }

  get hasMeals(): boolean {
    return this.meals.length > 0;
  }

  trackByMealId(_: number, meal: Meal): string {
    return meal.id;
  }

  startAddMeal(): void {
    this.closeMealMenu();
    this.mealDialogMode = 'create';
    this.mealDialogInitialMeal = null;
    this.isMealDialogOpen = true;
  }

  onDeleteMeal(meal: Meal): void {
    this.closeMealMenu();
    this.mealToDelete = meal;
    this.isDeleteDialogOpen = true;
  }

  async confirmDeleteMeal(): Promise<void> {
    if (!this.mealToDelete) {
      return;
    }

    const meal = this.mealToDelete;
    this.closeDeleteDialog();

    try {
      const member = this.memberStateService.getCurrentMember();

      if (!member) {
        return;
      }

      await this.mealsService.hideMealForMember(meal.id, member.id);
      await this.loadMeals(member.id);
      this.showToast(
        this.languageStateService
          .t('meals.removedToast')
          .replace('{{name}}', meal.name)
      );
    } catch (error) {
      console.error('Error hiding meal:', error);
    } finally {
      this.cdr.detectChanges();
    }
  }

  closeDeleteDialog(): void {
    this.isDeleteDialogOpen = false;
    this.mealToDelete = null;
  }

  toggleMealMenu(meal: Meal): void {
    const isSameMeal = this.openMealMenuId === meal.id;
    this.openMealMenuId = isSameMeal ? null : meal.id;
    this.selectedMealForActions = isSameMeal ? null : meal;
    this.mealActionSheetMode = 'actions';
  }

  closeMealMenu(): void {
    this.openMealMenuId = null;
    this.selectedMealForActions = null;
    this.mealActionSheetMode = 'actions';
    this.resetCalendarSelection();
  }

  async onMealActionSelected(actionId: string): Promise<void> {
    if (!this.selectedMealForActions) {
      return;
    }

    const meal = this.selectedMealForActions;

    switch (actionId) {
      case 'edit':
        this.closeMealMenu();
        this.startEditMeal(meal);
        break;

      case 'create-from-this':
        this.closeMealMenu();
        this.mealDialogMode = 'createFromExisting';
        this.mealDialogInitialMeal = meal;
        this.isMealDialogOpen = true;
        break;

      case 'add-to-plan':
        this.mealActionSheetMode = 'addToPlan';
        break;

      case 'add-today':
        await this.handleAddToPlanSelection('today');
        break;

      case 'add-tomorrow':
        await this.handleAddToPlanSelection('tomorrow');
        break;

      case 'pick-date':
        this.openPickDateMode();
        break;

      case 'remove':
        this.closeMealMenu();
        await this.onDeleteMeal(meal);
        break;

      default:
        break;
    }
  }

  isMobileViewport(): boolean {
    return window.innerWidth < 1024;
  }

  startEditMeal(meal: Meal): void {
    this.mealDialogMode = 'edit';
    this.mealDialogInitialMeal = meal;
    this.isMealDialogOpen = true;
    this.closeMealMenu();
  }

  get isSearching(): boolean {
    return !!this.mealSearchQuery.trim();
  }

  get filteredMeals(): Meal[] {
    return filterMealsByQuery(this.meals, this.mealSearchQuery).slice(0, 10);
  }

  openSearchMealDetails(meal: Meal): void {
    this.selectedSearchMeal = meal;
    this.isSearchMealDetailsOpen = true;
  }

  closeSearchMealDetails(): void {
    this.isSearchMealDetailsOpen = false;
    this.selectedSearchMeal = null;
  }

  clearMealSearch(): void {
    this.mealSearchQuery = '';
    this.closeSearchMealDetails();
  }

  get addToPlanActions(): ResponsiveActionMenuItem[] {
    return [
      { id: 'add-today', label: this.languageStateService.t('common.today') },
      { id: 'add-tomorrow', label: this.languageStateService.t('common.tomorrow') },
      { id: 'pick-date', label: this.languageStateService.t('common.pickDate') },
    ];
  }

  private async handleAddToPlanSelection(
    action: 'today' | 'tomorrow'
  ): Promise<void> {
    if (!this.selectedMealForActions || this.isAddToPlanLoading) return;

    const meal = this.selectedMealForActions;

    const date = new Date();
    if (action === 'tomorrow') {
      date.setDate(date.getDate() + 1);
    }

    const formattedDate = this.formatDate(date);
    const label =
      action === 'today'
        ? this.languageStateService.t('common.today')
        : this.languageStateService.t('common.tomorrow');

    this.isAddToPlanLoading = true;

    try {
      await this.mealPlanService.createPlannedMealFromExistingMeal(
        meal.id,
        null,
        formattedDate
      );

      this.closeMealMenu();
      this.showToast(
        this.languageStateService
          .t('meals.addedToDayToast')
          .replace('{{name}}', meal.name)
          .replace('{{day}}', label)
      );
    } catch (error) {
      console.error(error);
      this.closeMealMenu();
      this.showToast(this.languageStateService.t('meals.failedToAdd'));
    } finally {
      this.isAddToPlanLoading = false;
    }
  }

  private showToast(message: string, actionLabel: string | null = null): void {
    this.snackbarMessage = message;
    this.snackbarActionLabel = actionLabel;
    this.isSnackbarVisible = true;
    this.cdr.detectChanges();

    if (this.toastTimeout) {
      clearTimeout(this.toastTimeout);
    }

    this.toastTimeout = setTimeout(() => {
      this.hideToast();
    }, 2500);
  }

  hideToast(): void {
    this.isSnackbarVisible = false;
    this.snackbarMessage = null;
    this.snackbarActionLabel = null;
    this.cdr.detectChanges();
  }

  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  onCalendarDatesChange(dates: string[]): void {
    this.selectedPlanDates = dates;
  }

  openPickDateMode(): void {
    this.mealActionSheetMode = 'pickDate';
    this.resetCalendarSelection();
  }

  async confirmPickedDates(dates: string[]): Promise<void> {
    if (!this.selectedMealForActions || !dates.length) {
      return;
    }

    const meal = this.selectedMealForActions;

    try {
      for (const date of dates) {
        await this.mealPlanService.createPlannedMealFromExistingMeal(
          meal.id,
          null,
          date
        );
      }

      this.resetCalendarSelection();
      this.closeMealMenu();
      this.showToast(
        dates.length === 1
          ? this.languageStateService
            .t('meals.addedToDayToast')
            .replace('{{name}}', meal.name)
            .replace('{{day}}', this.formatToastDayLabel(dates[0]))
          : this.languageStateService
            .t('meals.addedToMultipleDaysToast')
            .replace('{{name}}', meal.name)
            .replace('{{count}}', String(dates.length))
      );
    } catch (error) {
      console.error(error);
      this.closeMealMenu();
      this.showToast(this.languageStateService.t('meals.failedToAdd'));
    }
  }

  private formatToastDayLabel(dateString: string): string {
    const date = new Date(`${dateString}T12:00:00`);
    const months = this.languageStateService.t('monthsLong') as unknown as string[];

    return `${date.getDate()} ${months[date.getMonth()]}`;
  }

  private resetCalendarSelection(): void {
    this.selectedPlanDates = [];
    this.calendarSelectionMode = 'single';
  }

  async onMealDialogSave(data: {
    mealName: string;
    prepTime: number | null;
    ingredients: string[];
    instructions: string;
    imageFile: File | null;
    mode: 'create' | 'edit' | 'createFromExisting';
  }): Promise<void> {
    const mealToUpdate = this.mealDialogInitialMeal;

    this.closeMealDialog();

    try {
      let imagePathForCreate: string | null = null;
      let imagePathForUpdate: string | undefined = undefined;

      if (data.mode === 'createFromExisting' && mealToUpdate?.image_path) {
        imagePathForCreate = mealToUpdate.image_path;
      }

      if (data.mode === 'edit' && mealToUpdate?.image_path) {
        imagePathForUpdate = mealToUpdate.image_path;
      }

      if (data.imageFile) {
        const extension = data.imageFile.name.split('.').pop() || 'jpg';
        const fileName = `${crypto.randomUUID()}.${extension}`;

        const uploadedImagePath = await this.supabaseService.uploadMealImage(
          data.imageFile,
          fileName
        );

        imagePathForCreate = uploadedImagePath;
        imagePathForUpdate = uploadedImagePath;
      }

      if (data.mode === 'edit' && mealToUpdate) {
        await this.mealsService.updateMeal(
          mealToUpdate.id,
          data.mealName,
          data.prepTime,
          data.ingredients,
          imagePathForUpdate,
          data.instructions
        );
      } else {
        await this.mealsService.createMeal(
          data.mealName,
          data.prepTime,
          data.ingredients,
          imagePathForCreate,
          data.instructions
        );
      }

      const member = this.memberStateService.getCurrentMember();
      if (member) {
        await this.loadMeals(member.id);
        this.showToast(
          data.mode === 'edit'
            ? this.languageStateService
              .t('meals.updatedToast')
              .replace('{{name}}', data.mealName)
            : this.languageStateService
              .t('meals.savedToast')
              .replace('{{name}}', data.mealName)
        );
      }
    } catch (error) {
      console.error('Error saving meal:', error);
    }
  }

  closeMealDialog(): void {
    this.isMealDialogOpen = false;
    this.mealDialogInitialMeal = null;
    this.mealDialogMode = 'create';
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    if (this.toastTimeout) {
      clearTimeout(this.toastTimeout);
    }
    this.destroy$.complete();
  }

}