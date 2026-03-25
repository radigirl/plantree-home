import {
  ChangeDetectorRef,
  Component,
  ElementRef,
  HostListener,
  OnInit,
  ViewChild,
} from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { PlannedMeal } from '../../../models/planned-meal.model';
import { FamilyMember } from '../../../models/family-member.model';

import { MealPlanService } from '../../../services/meal-plan.service';
import { PageLoadingComponent } from '../../../shared/components/page-loading/page-loading.component';
import { UserStateService } from '../../../services/user.state.service';
import { SupabaseService } from '../../../services/supabase.service';

import { MEAL_STATUS_LABELS, getNextStatus } from '../../../shared/utils/meal.utils';
import { filterMealsByQuery } from '../../../shared/utils/meal-search.util';

type DayDetailsFormMode = 'add' | 'edit-cook' | 'change-meal';
type AddMealMode = 'search' | 'new';
type ChangeMealMode = 'search' | 'create-from-current';

@Component({
  selector: 'app-day-details',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, PageLoadingComponent],
  templateUrl: './day-details.component.html',
  styleUrl: './day-details.component.scss',
})
export class DayDetailsComponent implements OnInit {
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
  availableUsers: FamilyMember[] = [];
  openMealMenuId: string | null = null;

  selectedImageFile: File | null = null;
  selectedImagePreview: string | null = null;

  mealInstructions = '';
  changeMealInstructions = '';

  mealIngredientsText = '';
  changeMealIngredientsText = '';

  availableMeals: {
    id: string;
    name: string;
    prepTime?: number;
    image?: string;
    ingredients?: string[];
    instructions?: string;
  }[] = [];

  addMealMode: AddMealMode = 'search';
  changeMealMode: ChangeMealMode = 'search';
  selectedExistingMealId: string | null = null;
  expandedMealId: string | null = null;

  mealSearchQuery = '';
  changeMealSearchQuery = '';

  showAdvanced = false;
  showChangeAdvanced = false;

  private returnToMealId: string | null = null;

  @ViewChild('mealFormContainer') mealFormContainer?: ElementRef<HTMLElement>;

  constructor(
    private route: ActivatedRoute,
    private mealPlanService: MealPlanService,
    private userStateService: UserStateService,
    private supabaseService: SupabaseService,
    private cdr: ChangeDetectorRef,
    private router: Router,
  ) {}

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

    await this.loadUsers();

    if (!this.date) {
      this.isLoading = false;
      this.meals = [];
      this.cdr.detectChanges();
      return;
    }

    await this.loadMealsForDate(this.date);

    this.route.queryParamMap.subscribe(async (params) => {
      const shouldOpenAddForm = params.get('add') === 'true';

      if (shouldOpenAddForm && !this.isPastDate() && !this.isFormOpen) {
        await this.startAddMeal();
        this.cdr.detectChanges();
      }
    });
  }

  async loadUsers(): Promise<void> {
    try {
      const users = await this.supabaseService.getUsers();
      this.availableUsers = users ?? [];
    } catch (error) {
      console.error('Error loading users:', error);
      this.availableUsers = [];
    }
  }

  async loadMealsForDate(date: string): Promise<void> {
    this.isLoading = true;
    this.openMealMenuId = null;

    try {
      this.meals = await this.mealPlanService.getMealsForDate(date);
    } catch (error) {
      console.error('Error loading meals for selected day:', error);
      this.meals = [];
    } finally {
      this.isLoading = false;
      this.cdr.detectChanges();
    }
  }

  async loadAvailableMeals(): Promise<void> {
    try {
      const currentUser = this.userStateService.getCurrentUser();

      if (!currentUser) {
        this.availableMeals = [];
        return;
      }

      this.availableMeals = await this.mealPlanService.getAvailableMealsForPlanning(
        currentUser.id
      );
    } catch (error) {
      console.error('Error loading available meals:', error);
      this.availableMeals = [];
    }
  }

  get createFromCurrentHasDetails(): boolean {
    return !!(
      this.changeMealIngredientsText.trim() ||
      this.changeMealInstructions.trim()
    );
  }

  get newMealHasDetails(): boolean {
    return !!(
      this.mealIngredientsText.trim() ||
      this.mealInstructions.trim()
    );
  }

  get filteredAvailableMeals() {
    return filterMealsByQuery(this.availableMeals, this.mealSearchQuery);
  }

  get filteredChangeMealOptions() {
    return filterMealsByQuery(this.availableMeals, this.changeMealSearchQuery);
  }

  get displayedAvailableMeals() {
  if (this.selectedExistingMealId) {
    return this.filteredAvailableMeals.filter(
      (meal) => meal.id === this.selectedExistingMealId
    );
  }

  if (!this.mealSearchQuery.trim()) {
    return this.availableMeals.slice(0, 3);
  }

  return this.filteredAvailableMeals;
}

get displayedChangeMealOptions() {
  if (this.selectedExistingMealId) {
    return this.filteredChangeMealOptions.filter(
      (meal) => meal.id === this.selectedExistingMealId
    );
  }

  if (!this.changeMealSearchQuery.trim()) {
    return this.availableMeals.slice(0, 3);
  }

  return this.filteredChangeMealOptions;
}

  clearMealSearch(): void {
    this.mealSearchQuery = '';
    this.selectedExistingMealId = null;
  }

  clearChangeMealSearch(): void {
    this.changeMealSearchQuery = '';
    this.selectedExistingMealId = null;
  }

  selectMealForAdd(mealId: string): void {
    this.selectedExistingMealId = mealId;
  }

  selectMealForChange(mealId: string): void {
    this.selectedExistingMealId = mealId;
  }

  setAddMealMode(mode: AddMealMode): void {
    this.addMealMode = mode;

    this.mealSearchQuery = '';
    this.selectedExistingMealId = null;
    this.showAdvanced = false;

    if (mode === 'search') {
      this.newMealName = '';
      this.newPrepTime = null;
      this.selectedImagePreview = null;
      this.selectedImageFile = null;
      this.mealIngredientsText = '';
      this.mealInstructions = '';
    }
  }

  setChangeMealMode(mode: ChangeMealMode): void {
    this.changeMealMode = mode;

    this.changeMealSearchQuery = '';
    this.selectedExistingMealId = null;
    this.showChangeAdvanced = false;

    if (mode === 'search') {
      this.newMealName = '';
      this.newPrepTime = null;
      this.selectedImagePreview = null;
      this.selectedImageFile = null;
      this.changeMealIngredientsText = '';
      this.changeMealInstructions = '';
      return;
    }

    const currentMeal = this.meals.find(
      (meal) => meal.id === this.editingPlannedMealId
    )?.meal;

    this.newMealName = currentMeal?.name ?? '';
    this.newPrepTime = currentMeal?.prepTime ?? null;
    this.selectedImagePreview = currentMeal?.image ?? null;
    this.selectedImageFile = null;
    this.changeMealIngredientsText = (currentMeal?.ingredients ?? []).join('\n');
    this.changeMealInstructions = currentMeal?.instructions ?? '';
  }

  toggleMeal(mealId: string): void {
    this.expandedMealId = this.expandedMealId === mealId ? null : mealId;
  }

  async startAddMeal(): Promise<void> {
    if (this.isPastDate()) {
      return;
    }

    this.isFormOpen = true;
    this.cdr.detectChanges();

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
    this.showAdvanced = false;
    this.showChangeAdvanced = false;

    const currentUser = this.userStateService.getCurrentUser();
    this.selectedCookId = currentUser?.id ?? null;

    this.selectedExistingMealId = null;
    this.mealSearchQuery = '';
    this.changeMealSearchQuery = '';

    await this.loadAvailableMeals();
    this.addMealMode = this.availableMeals.length > 0 ? 'search' : 'new';
  }

  goBack(): void {
    window.history.back();
  }

  async onEditCook(meal: PlannedMeal): Promise<void> {
    if (this.isPastDate()) {
      return;
    }

    this.returnToMealId = meal.id;
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
    this.mealSearchQuery = '';
    this.changeMealSearchQuery = '';

    this.closeMealMenu();
    this.scrollFormIntoView();
  }

  async onChangeMeal(meal: PlannedMeal): Promise<void> {
    if (this.isPastDate()) {
      return;
    }

    this.returnToMealId = meal.id;
    this.isFormOpen = true;
    this.formMode = 'change-meal';
    this.editingPlannedMealId = meal.id;
    this.editingMealId = meal.meal.id;

    this.newMealName = meal.meal.name ?? '';
    this.newPrepTime = meal.meal.prepTime ?? null;
    this.selectedCookId = meal.cook?.id ?? null;
    this.selectedImageFile = null;
    this.selectedImagePreview = meal.meal.image ?? null;

    this.changeMealIngredientsText = (meal.meal.ingredients ?? []).join('\n');
    this.changeMealInstructions = meal.meal.instructions ?? '';

    this.changeMealMode = 'create-from-current';
    this.selectedExistingMealId = meal.meal.id;
    this.changeMealSearchQuery = '';
    this.showChangeAdvanced = false;

    await this.loadAvailableMeals();

    this.closeMealMenu();
    this.scrollFormIntoView();
  }

  cancelAddMeal(): void {
    const source = this.getAddSource();
    const shouldRestoreToMeal =
      this.formMode === 'edit-cook' || this.formMode === 'change-meal';

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
    this.mealSearchQuery = '';
    this.changeMealSearchQuery = '';
    this.showAdvanced = false;
    this.showChangeAdvanced = false;

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

    if (shouldRestoreToMeal) {
      this.restoreToEditedMealCard();
    } else {
      this.returnToMealId = null;
    }
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
  const reader = new FileReader();
  reader.onload = () => {
    this.selectedImagePreview = reader.result as string;
    this.cdr.detectChanges();
  };
  reader.readAsDataURL(file);
}

  removeSelectedMealImage(): void {
    this.selectedImageFile = null;
    this.selectedImagePreview = null;
  }

  async saveMeal(): Promise<void> {
    if (!this.date) {
      return;
    }

    try {
      if (this.addMealMode === 'search') {
        if (!this.selectedExistingMealId) {
          return;
        }

        await this.mealPlanService.createPlannedMealFromExistingMeal(
          this.selectedExistingMealId,
          this.selectedCookId,
          this.date
        );
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

      this.cancelAddMeal();
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

      this.cancelAddMeal();
      await this.loadMealsForDate(this.date);
      this.restoreToEditedMealCard();
    } catch (error) {
      console.error('Error updating planned meal cook:', error);
    } finally {
      this.cdr.detectChanges();
    }
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

        let imagePath: string | null = null;

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

      this.cancelAddMeal();
      await this.loadMealsForDate(this.date);
      this.restoreToEditedMealCard();
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

  private scrollFormIntoView(): void {
    setTimeout(() => {
      const form = this.mealFormContainer?.nativeElement;

      if (!form) return;

      const rect = form.getBoundingClientRect();
      const absoluteTop = window.scrollY + rect.top;
      const topOffset = 140;

      window.scrollTo({
        top: Math.max(absoluteTop - topOffset, 0),
        behavior: 'smooth',
      });
    }, 0);
  }

  getStatusLabel(status: string): string {
    return MEAL_STATUS_LABELS[status] || status;
  }

  getMealCountLabel(): string {
    return `${this.meals.length} meal${this.meals.length === 1 ? '' : 's'} planned`;
  }

  getDisplayDate(): string {
    if (!this.date) {
      return 'Selected day';
    }

    const parsedDate = new Date(this.date);

    if (Number.isNaN(parsedDate.getTime())) {
      return this.date;
    }

    return parsedDate.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
    });
  }

  getDayName(): string {
    if (!this.date) return '';

    const date = new Date(this.date);
    return date.toLocaleDateString('en-US', { weekday: 'long' });
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

  getFormTitle(): string {
    switch (this.formMode) {
      case 'edit-cook':
        return 'Edit cook';
      case 'change-meal':
        return 'Change meal';
      default:
        return 'Add meal';
    }
  }

  toggleMealMenu(mealId: string): void {
    if (this.isPastDate()) {
      return;
    }

    this.openMealMenuId = this.openMealMenuId === mealId ? null : mealId;
  }

  closeMealMenu(): void {
    this.openMealMenuId = null;
  }

  async onPrimaryAction(meal: PlannedMeal): Promise<void> {
    if (this.isPastDate() || !this.date) {
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
      this.closeMealMenu();
      await this.loadMealsForDate(this.date);
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

    const confirmed = window.confirm(
      `Remove "${meal.meal.name}" from this day?`
    );

    if (!confirmed) {
      return;
    }

    try {
      await this.mealPlanService.deletePlannedMeal(meal.id);
      this.meals = this.meals.filter((item) => item.id !== meal.id);
      this.closeMealMenu();
    } catch (error) {
      console.error('Error removing planned meal:', error);
    } finally {
      this.cdr.detectChanges();
    }
  }

  openMealDetails(meal: PlannedMeal): void {
    this.router.navigate(['/meal', meal.meal.id], {
      queryParams: {
        source: 'plan',
        name: meal.meal.name,
      },
    });
  }

  private scrollToMealCardInstant(mealId: string): void {
    const card = document.getElementById(`meal-card-${mealId}`);
    if (!card) return;

    const rect = card.getBoundingClientRect();
    const absoluteTop = window.scrollY + rect.top;
    const topOffset = 140;

    window.scrollTo(0, Math.max(absoluteTop - topOffset, 0));
  }

  private restoreToEditedMealCard(): void {
    if (!this.returnToMealId) {
      return;
    }

    const mealId = this.returnToMealId;
    this.returnToMealId = null;

    setTimeout(() => {
      this.scrollToMealCardInstant(mealId);
    }, 0);
  }
}