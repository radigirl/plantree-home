import {
  ChangeDetectorRef,
  Component,
  HostListener,
  OnDestroy,
  OnInit,
} from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { PlannedMeal } from '../../../models/planned-meal.model';
import { Member } from '../../../models/member.model';

import { MealPlanService } from '../../../services/meal-plan.service';
import { PageLoadingComponent } from '../../../shared/components/page-loading/page-loading.component';
import { MemberStateService } from '../../../services/member.state.service';
import { SupabaseService } from '../../../services/supabase.service';

import { MEAL_STATUS_LABELS, getNextStatus } from '../../../shared/utils/meal.utils';
import { ResponsiveActionMenuComponent, ResponsiveActionMenuItem } from '../../../shared/components/responsive-action-menu/responsive-action-menu';
import { ConfirmationDialogComponent } from '../../../shared/components/confirmation-dialog/confirmation-dialog.component';
import { SpaceStateService } from '../../../services/space.state.service';
import { Subject } from 'rxjs';
import { takeUntil, filter, map, distinctUntilChanged } from 'rxjs/operators';
import { LucideAngularModule, Clock3, UserRound } from 'lucide-angular';
import { DayMealFormDialogComponent } from '../day-meal-form-dialog/day-meal-form-dialog.component';
import { DayMealDetailsDialogComponent } from '../day-meal-details-dialog/day-meal-details-dialog.component';
import { SnackbarComponent } from '../../../shared/components/snackbar/snackbar.component';

type DayDetailsFormMode = 'add' | 'edit-cook' | 'change-meal';
type AddMealMode = 'search' | 'new';
type ChangeMealMode = 'search' | 'create-from-current';

@Component({
  selector: 'app-day-details',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, PageLoadingComponent, ResponsiveActionMenuComponent, ConfirmationDialogComponent, LucideAngularModule, DayMealFormDialogComponent, DayMealDetailsDialogComponent, SnackbarComponent],
  templateUrl: './day-details.component.html',
  styleUrl: './day-details.component.scss',
})
export class DayDetailsComponent implements OnInit, OnDestroy {
  date: string | null = null;
  meals: PlannedMeal[] = [];
  isLoading = true;

  isFormOpen = false;
  formMode: DayDetailsFormMode = 'add';

  editingPlannedMealId: string | null = null;
  editingMealId: string | null = null;

  newMealName = '';
  newPrepTime: number | null = null;
  selectedCookId: number | null = null;
  availableMembers: Member[] = [];
  openMealMenuId: string | null = null;

  selectedImageFile: File | null = null;
  selectedImagePreview: string | null = null;

  mealInstructions = '';
  changeMealInstructions = '';

  mealIngredientsText = '';
  changeMealIngredientsText = '';
  selectedMealForForm: PlannedMeal | null = null;

  availableMeals: {
    id: string;
    name: string;
    prepTime?: number;
    image_url?: string;
    ingredients?: string[];
    instructions?: string;
    created_at: string;
  }[] = [];

  addMealMode: AddMealMode = 'search';
  changeMealMode: ChangeMealMode = 'search';
  selectedExistingMealId: string | null = null;
  selectedExistingMealIds: string[] = [];

  selectedMealForActions: PlannedMeal | null = null;

  mealActions: ResponsiveActionMenuItem[] = [
    { id: 'change', label: 'Change meal' },
    { id: 'edit-cook', label: 'Change cook' },
    { id: 'remove', label: 'Remove' },
  ];

  isDeleteConfirmOpen = false;
  mealPendingDelete: PlannedMeal | null = null;

  coveredMealIds = new Set<string>();
  mealIdToListName: Record<string, string> = {};
  readonly Clock3 = Clock3;
  readonly UserRound = UserRound;

  selectedMealForDetails: PlannedMeal | null = null;

  entrySource: string | null = null;

  snackbarMessage = '';
  snackbarVisible = false;
  private snackbarTimeoutId: ReturnType<typeof setTimeout> | null = null;

  private destroy$ = new Subject<void>();


  constructor(
    private route: ActivatedRoute,
    private mealPlanService: MealPlanService,
    private memberStateService: MemberStateService,
    private supabaseService: SupabaseService,
    private spaceStateService: SpaceStateService,
    private cdr: ChangeDetectorRef,
    private router: Router,
  ) { }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement | null;

    if (!target) {
      return;
    }

    const clickedInsideMenu = target.closest('.meal-menu-wrapper');

    if (!clickedInsideMenu) {
      this.closeMealMenu();
    }
  }

  async ngOnInit(): Promise<void> {
    this.date = this.route.snapshot.paramMap.get('date');

    await this.loadMembers();

    if (!this.date) {
      this.isLoading = false;
      this.meals = [];
      this.cdr.detectChanges();
      return;
    }

    this.spaceStateService.currentSpace$
      .pipe(
        takeUntil(this.destroy$),
        filter((space): space is NonNullable<typeof space> => !!space),
        map(space => space.id),
        distinctUntilChanged()
      )
      .subscribe(async () => {
        if (!this.date) {
          return;
        }

        this.isFormOpen = false;
        this.openMealMenuId = null;
        this.selectedMealForActions = null;

        await this.loadMealsForDate(this.date);
      });

    await this.loadMealsForDate(this.date);

    this.route.queryParamMap
      .pipe(takeUntil(this.destroy$))
      .subscribe(async (params) => {
        const source = params.get('source');

        if (source === 'home' || source === 'plan') {
          this.entrySource = source;
        }

        const shouldOpenAddForm = params.get('add') === 'true';

        if (shouldOpenAddForm && !this.isPastDate() && !this.isFormOpen) {
          await this.startAddMeal();
          this.cdr.detectChanges();
        }
      });
  }

  async loadMembers(): Promise<void> {
    try {
      const members = await this.supabaseService.getMembers();
      this.availableMembers = members ?? [];
    } catch (error) {
      console.error('Error loading members:', error);
      this.availableMembers = [];
    }
  }

  async loadMealsForDate(date: string): Promise<void> {
    this.isLoading = true;
    this.openMealMenuId = null;

    try {
      this.meals = await this.mealPlanService.getMealsForDate(date);
      await this.loadCoverageForMeals();
    } catch (error) {
      console.error('Error loading meals for selected day:', error);
      this.meals = [];
      this.coveredMealIds = new Set();
      this.mealIdToListName = {};
    } finally {
      this.isLoading = false;
      this.cdr.detectChanges();
    }
  }

  private async loadCoverageForMeals(): Promise<void> {
    try {
      const coverage = await this.mealPlanService.getCoverageForMeals(
        this.meals.map((meal) => String(meal.id))
      );

      this.coveredMealIds = new Set(coverage.map((item) => String(item.mealId)));

      this.mealIdToListName = {};
      for (const item of coverage) {
        this.mealIdToListName[String(item.mealId)] = item.listName;
      }
    } catch (error) {
      console.error('Error loading meal coverage:', error);
      this.coveredMealIds = new Set();
      this.mealIdToListName = {};
    }
  }

  async loadAvailableMeals(): Promise<void> {
    try {
      const currentMember = this.memberStateService.getCurrentMember();

      if (!currentMember) {
        this.availableMeals = [];
        return;
      }

      this.availableMeals = await this.mealPlanService.getAvailableMealsForPlanning(
        currentMember.id
      );
    } catch (error) {
      console.error('Error loading available meals:', error);
      this.availableMeals = [];
    }
  }


  async startAddMeal(): Promise<void> {
    if (this.isPastDate()) {
      return;
    }

    this.formMode = 'add';
    this.editingPlannedMealId = null;
    this.editingMealId = null;
    this.openMealMenuId = null;

    this.newMealName = '';
    this.newPrepTime = null;
    this.selectedImageFile = null;
    this.selectedImagePreview = null;
    this.mealInstructions = '';
    this.changeMealInstructions = '';
    this.mealIngredientsText = '';
    this.changeMealIngredientsText = '';
    this.selectedMealForForm = null;

    const currentMember = this.memberStateService.getCurrentMember();
    this.selectedCookId = currentMember?.id ?? null;

    this.selectedExistingMealId = null;
    this.selectedExistingMealIds = [];

    await this.loadAvailableMeals();

    this.addMealMode = this.availableMeals.length > 0 ? 'search' : 'new';

    this.isFormOpen = true;
    this.cdr.detectChanges();
  }


  getBackLabel(): string {
    const source = this.getSource();

    if (source === 'home') return 'Home';
    if (source === 'plan') return 'Plan';

    return 'Back';
  }

  private getSource(): string | null {
    return this.entrySource ?? this.route.snapshot.queryParamMap.get('source');
  }

  goBack(): void {
    const source = this.getSource();

    if (source === 'home') {
      this.router.navigate(['/home']);
      return;
    }

    if (source === 'plan') {
      this.router.navigate(['/plan']);
      return;
    }
    window.history.back();
  }

  async onEditCook(meal: PlannedMeal): Promise<void> {
    this.isFormOpen = true;
    this.formMode = 'edit-cook';
    this.editingPlannedMealId = meal.id;
    this.editingMealId = meal.meal.id;
    this.selectedCookId = meal.cook?.id ?? null;

    this.newMealName = '';
    this.newPrepTime = null;
    this.selectedImageFile = null;
    this.selectedImagePreview = null;
    this.selectedExistingMealId = null;
    this.selectedExistingMealIds = [];
    this.selectedMealForForm = meal;
    this.closeMealMenu();
  }

  async onChangeMeal(meal: PlannedMeal): Promise<void> {
    if (this.isPastDate()) {
      return;
    }
    this.isFormOpen = true;
    this.formMode = 'change-meal';
    this.editingPlannedMealId = meal.id;
    this.editingMealId = meal.meal.id;
    this.newMealName = meal.meal.name ?? '';
    this.newPrepTime = meal.meal.prepTime ?? null;
    this.selectedCookId = meal.cook?.id ?? null;
    this.selectedImageFile = null;
    this.selectedImagePreview = meal.meal.image_url ?? null;
    this.changeMealIngredientsText = (meal.meal.ingredients ?? []).join('\n');
    this.changeMealInstructions = meal.meal.instructions ?? '';
    this.changeMealMode = 'create-from-current';
    this.selectedExistingMealId = meal.meal.id;
    this.selectedMealForForm = meal;
    await this.loadAvailableMeals();

    this.closeMealMenu();
  }

  cancelAddMeal(): void {
    const modeBeforeReset = this.formMode;
    const source = this.getAddSource();

    this.isFormOpen = false;
    this.formMode = 'add';
    this.editingPlannedMealId = null;
    this.editingMealId = null;
    this.newMealName = '';
    this.newPrepTime = null;
    this.selectedCookId = null;
    this.openMealMenuId = null;
    this.selectedImageFile = null;
    this.selectedImagePreview = null;
    this.mealInstructions = '';
    this.changeMealInstructions = '';
    this.mealIngredientsText = '';
    this.changeMealIngredientsText = '';
    this.changeMealMode = 'search';
    this.addMealMode = 'search';
    this.selectedExistingMealId = null;
    this.selectedExistingMealIds = [];
    this.selectedMealForForm = null;

    if (modeBeforeReset !== 'add') {
      return;
    }

    if (source === 'plan') {
      this.router.navigate(['/plan']);
      return;
    }

    if (source === 'home') {
      this.router.navigate(['/home']);
      return;
    }

    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        add: null,
        source: null,
      },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }



  async saveMeal(): Promise<void> {
    if (!this.date) {
      return;
    }

    try {
      if (this.addMealMode === 'search') {
        if (this.selectedExistingMealIds.length === 0) {
          return;
        }

        for (const mealId of this.selectedExistingMealIds) {
          await this.mealPlanService.createPlannedMealFromExistingMeal(
            mealId,
            this.selectedCookId,
            this.date
          );
        }
      } else {
        if (!this.newMealName.trim()) {
          return;
        }

        let imagePath: string | null = null;

        if (this.selectedImageFile) {
          const extension = this.selectedImageFile.name.split('.').pop() || 'jpg';
          const fileName = `${crypto.randomUUID()}.${extension}`;

          imagePath = await this.supabaseService.uploadMealImage(
            this.selectedImageFile,
            fileName
          );
        }

        const parsedIngredients = this.mealIngredientsText
          .split(/[\n,]/)
          .map((item) => item.trim())
          .filter(Boolean);

        await this.mealPlanService.createMealAndPlan(
          this.newMealName.trim(),
          this.newPrepTime,
          this.selectedCookId,
          this.date,
          imagePath,
          this.mealInstructions.trim() || null,
          parsedIngredients
        );
      }

      this.closeFormAfterSave();
      await this.loadMealsForDate(this.date);
    } catch (error) {
      console.error('Error saving meal:', error);
    } finally {
      this.cdr.detectChanges();
    }
  }

  async saveEditCook(): Promise<void> {
    if (!this.date || !this.editingPlannedMealId) {
      return;
    }

    try {
      await this.mealPlanService.updatePlannedMealCook(
        this.editingPlannedMealId,
        this.selectedCookId
      );

      this.closeFormAfterSave();
      await this.loadMealsForDate(this.date);
    } catch (error) {
      console.error('Error updating planned meal cook:', error);
    } finally {
      this.cdr.detectChanges();
    }
  }

  private getMealStoragePath(imageUrl?: string | null): string | null {
    if (!imageUrl) return null;

    const marker = '/storage/v1/object/public/';
    const markerIndex = imageUrl.indexOf(marker);

    if (markerIndex === -1) {
      return imageUrl;
    }

    const afterPublic = imageUrl.slice(markerIndex + marker.length);
    const parts = afterPublic.split('/');

    return parts.slice(1).join('/');
  }

  async saveChangeMeal(): Promise<void> {
    if (!this.date || !this.editingPlannedMealId) {
      return;
    }

    try {
      if (this.changeMealMode === 'search') {
        if (!this.selectedExistingMealId) {
          return;
        }

        await this.mealPlanService.updatePlannedMealMeal(
          this.editingPlannedMealId,
          this.selectedExistingMealId,
          this.selectedCookId
        );
      } else {
        if (!this.newMealName.trim()) {
          return;
        }

        const currentPlannedMeal = this.meals.find(
          (meal) => meal.id === this.editingPlannedMealId
        );

        let imagePath: string | null = this.getMealStoragePath(
          currentPlannedMeal?.meal.image_url ?? null
        );

        if (this.selectedImageFile) {
          const extension = this.selectedImageFile.name.split('.').pop() || 'jpg';
          const fileName = `${crypto.randomUUID()}.${extension}`;

          imagePath = await this.supabaseService.uploadMealImage(
            this.selectedImageFile,
            fileName
          );
        }

        const parsedIngredients = this.changeMealIngredientsText
          .split('\n')
          .map((item) => item.trim())
          .filter(Boolean);

        await this.mealPlanService.createMealAndReplacePlannedMeal(
          this.editingPlannedMealId,
          this.newMealName.trim(),
          this.newPrepTime,
          this.selectedCookId,
          imagePath,
          this.changeMealInstructions.trim() || null,
          parsedIngredients
        );
      }

      this.closeFormAfterSave();
      await this.loadMealsForDate(this.date);
    } catch (error) {
      console.error('Error changing planned meal meal:', error);
    } finally {
      this.cdr.detectChanges();
    }
  }

  openAddMealFromDay(): void {
    if (!this.date || this.isPastDate()) {
      return;
    }

    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        add: 'true',
        source: 'day',
      },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  private getAddSource(): string | null {
    return this.route.snapshot.queryParamMap.get('source');
  }


  getStatusLabel(status: string): string {
    return MEAL_STATUS_LABELS[status] || status;
  }


  getDayName(): string {
    if (!this.date) return '';

    const date = new Date(this.date);
    return date.toLocaleDateString('en-US', { weekday: 'short' });
  }

  getShortDate(): string {
    if (!this.date) return '';
    const date = new Date(this.date);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  }

  isPastDate(): boolean {
    if (!this.date) {
      return false;
    }

    const selectedDate = new Date(this.date);
    selectedDate.setHours(0, 0, 0, 0);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return selectedDate.getTime() < today.getTime();
  }

  getPrimaryActionLabel(status: string): string | null {
    switch (status) {
      case 'to-prepare':
        return 'Start cooking';
      case 'in-progress':
        return 'Mark ready';
      case 'ready-to-serve':
        return 'Reset';
      default:
        return null;
    }
  }

  getPastStatusActionLabel(status: string): string | null {
    if (!this.isPastDate()) {
      return null;
    }

    switch (status) {
      case 'to-prepare':
      case 'in-progress':
        return 'Mark ready';

      case 'ready-to-serve':
        return 'Reset status';

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
        return '↺';
      default:
        return '';
    }
  }


  toggleMealMenu(meal: PlannedMeal): void {
    const isSameMeal = this.openMealMenuId === meal.id;
    this.openMealMenuId = isSameMeal ? null : meal.id;
    this.selectedMealForActions = isSameMeal ? null : meal;
  }

  closeMealMenu(): void {
    this.openMealMenuId = null;
    this.selectedMealForActions = null;
  }

  async onPrimaryAction(meal: PlannedMeal): Promise<void> {
    if (!this.date) {
      return;
    }

    const nextStatus = getNextStatus(meal.status) as
      | 'to-prepare'
      | 'in-progress'
      | 'ready-to-serve'
      | null;

    if (!nextStatus) {
      return;
    }

    try {
      await this.mealPlanService.updatePlannedMealStatus(meal.id, nextStatus);

      await this.loadMealsForDate(this.date);

      if (this.selectedMealForDetails) {
        this.selectedMealForDetails =
          this.meals.find((item) => item.id === meal.id) ?? null;
      }

    } catch (error) {
      console.error('Error updating meal status:', error);
    } finally {
      this.cdr.detectChanges();
    }
  }

  async onRemoveMeal(meal: PlannedMeal): Promise<void> {
    if (!this.date || this.isPastDate()) {
      return;
    }

    this.mealPendingDelete = meal;
    this.isDeleteConfirmOpen = true;
  }

  getDeleteConfirmMessage(): string {
    return this.mealPendingDelete
      ? `Remove "${this.mealPendingDelete.meal.name}" from this day?`
      : 'Do you want to continue?';
  }

  closeDeleteConfirm(): void {
    this.isDeleteConfirmOpen = false;
    this.mealPendingDelete = null;
  }

  async confirmRemoveMeal(): Promise<void> {
    if (!this.date || this.isPastDate() || !this.mealPendingDelete) {
      return;
    }

    try {
      await this.mealPlanService.deletePlannedMeal(this.mealPendingDelete.id);
      this.meals = this.meals.filter((item) => item.id !== this.mealPendingDelete?.id);
      this.closeMealMenu();
      this.closeDeleteConfirm();
    } catch (error) {
      console.error('Error removing planned meal:', error);
    } finally {
      this.cdr.detectChanges();
    }
  }

  isDesktopViewport(): boolean {
    return window.innerWidth >= 1024;
  }

  getResponsiveMealActions(meal: PlannedMeal): ResponsiveActionMenuItem[] {
    if (this.isPastDate()) {
      const actions: ResponsiveActionMenuItem[] = [
        { id: 'edit-cook', label: 'Change cook' },
      ];

      const statusLabel = this.getPastStatusActionLabel(meal.status);

      if (statusLabel) {
        actions.push({ id: 'primary', label: statusLabel });
      }

      return actions;
    }

    return [
      { id: 'change', label: 'Change meal' },
      { id: 'edit-cook', label: 'Change cook' },
      { id: 'remove', label: 'Remove' },
    ];
  }

  async onMealActionSelected(actionId: string): Promise<void> {
    if (!this.selectedMealForActions) {
      return;
    }

    const meal = this.selectedMealForActions;
    this.closeMealMenu();

    switch (actionId) {
      case 'primary':
        await this.onPrimaryAction(meal);
        break;

      case 'change':
        await this.onChangeMeal(meal);
        break;

      case 'edit-cook':
        await this.onEditCook(meal);
        break;

      case 'remove':
        await this.onRemoveMeal(meal);
        break;

      default:
        break;
    }
  }

  isMealCovered(mealId: string): boolean {
    return this.coveredMealIds.has(String(mealId));
  }

  getMealCoverageListName(mealId: string): string | null {
    return this.mealIdToListName[String(mealId)] ?? null;
  }

  async onDayMealFormSaved(event: {
  mode: 'add' | 'edit-cook' | 'change-meal';
  cookId: number | null;
  selectedMealId?: string | null;
  selectedMealIds?: string[];
  changeMealMode?: 'search' | 'create-from-current';
  addMealMode?: 'search' | 'new';

  newMealName?: string;
  newPrepTime?: number | null;
  mealIngredientsText?: string;
  mealInstructions?: string;
  changeMealIngredientsText?: string;
  changeMealInstructions?: string;
  selectedImageFile?: File | null;
}): Promise<void> {
  if (event.mode === 'edit-cook') {
    this.selectedCookId = event.cookId;
    await this.saveEditCook();
    this.showSnackbar('Cook updated');
    return;
  }

  if (event.mode === 'change-meal') {
    this.selectedCookId = event.cookId;
    this.changeMealMode = event.changeMealMode ?? 'search';
    this.selectedExistingMealId = event.selectedMealId ?? null;

    this.newMealName = event.newMealName ?? '';
    this.newPrepTime = event.newPrepTime ?? null;
    this.selectedImageFile = event.selectedImageFile ?? null;
    this.selectedImagePreview = null;
    this.changeMealIngredientsText = event.changeMealIngredientsText ?? '';
    this.changeMealInstructions = event.changeMealInstructions ?? '';

    await this.saveChangeMeal();
    this.showSnackbar('Meal changed');
    return;
  }

  if (event.mode === 'add') {
    this.selectedCookId = event.cookId;
    this.addMealMode = event.addMealMode ?? 'search';
    this.selectedExistingMealId = event.selectedMealId ?? null;
    this.selectedExistingMealIds = event.selectedMealIds ?? [];

    this.newMealName = event.newMealName ?? '';
    this.newPrepTime = event.newPrepTime ?? null;
    this.mealIngredientsText = event.mealIngredientsText ?? '';
    this.mealInstructions = event.mealInstructions ?? '';
    this.selectedImageFile = event.selectedImageFile ?? null;
    this.selectedImagePreview = null;

    const addedMealsCount = this.selectedExistingMealIds.length;
    const singleAddedMealId =
      addedMealsCount === 1 ? this.selectedExistingMealIds[0] : null;
    const newMealNameForSnackbar = this.newMealName.trim();

    await this.saveMeal();

    if (this.addMealMode === 'search') {
      if (addedMealsCount > 1) {
        this.showSnackbar(`${addedMealsCount} meals added`);
      } else if (singleAddedMealId) {
        const meal = this.availableMeals.find((m) => m.id === singleAddedMealId);
        this.showSnackbar(meal ? `${meal.name} added` : 'Meal added');
      } else {
        this.showSnackbar('Meal added');
      }
    } else if (this.addMealMode === 'new' && newMealNameForSnackbar) {
      this.showSnackbar(`${newMealNameForSnackbar} added`);
    } else {
      this.showSnackbar('Meal added');
    }

    return;
  }
}

  openMealDetailsDialog(meal: PlannedMeal): void {
    this.selectedMealForDetails = meal;
  }

  closeMealDetailsDialog(): void {
    this.selectedMealForDetails = null;
  }

  private closeFormAfterSave(): void {
    this.isFormOpen = false;
    this.formMode = 'add';
    this.editingPlannedMealId = null;
    this.editingMealId = null;
    this.selectedMealForForm = null;
    this.selectedExistingMealId = null;
    this.selectedExistingMealIds = [];

    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        add: null,
      },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  private showSnackbar(message: string): void {
    this.snackbarMessage = message;
    this.snackbarVisible = true;

    setTimeout(() => {
      this.snackbarVisible = false;
      this.cdr.detectChanges();
    }, 2500);

    this.cdr.detectChanges();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

}