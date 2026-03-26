import {
  ChangeDetectorRef,
  Component,
  ElementRef,
  HostListener,
  OnInit,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { Meal } from '../../models/meal.model';
import { MealsService } from '../../services/meal.service';
import { SupabaseService } from '../../services/supabase.service';
import { PageLoadingComponent } from '../../shared/components/page-loading/page-loading.component';
import { UserStateService } from '../../services/user.state.service';
import { filterMealsByQuery } from '../../shared/utils/meal-search.util';
import { MealDetailsModalComponent } from './meal-details-modal/meal-details-modal.component';
import {
  ResponsiveActionMenuComponent,
  ResponsiveActionMenuItem,
} from '../../shared/components/responsive-action-menu/responsive-action-menu';

@Component({
  selector: 'app-meals',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    PageLoadingComponent,
    MealDetailsModalComponent,
    ResponsiveActionMenuComponent,
  ],
  templateUrl: './meals.component.html',
  styleUrl: './meals.component.scss',
})
export class MealsComponent implements OnInit {
  meals: Meal[] = [];
  isLoading = true;

  isAddingMeal = false;
  isEditingMeal = false;
  editingMealId: string | null = null;

  newMealName = '';
  newPrepTime: number | null = null;
  newIngredientsText = '';
  newInstructions = '';

  selectedImageFile: File | null = null;
  selectedImagePreview: string | null = null;

  openMealMenuId: string | null = null;
  expandedMealId: string | null = null;
  private returnToMealId: string | null = null;

  mealSearchQuery = '';
  selectedSearchMeal: Meal | null = null;
  isSearchMealDetailsOpen = false;

  selectedMealForActions: Meal | null = null;

  mealActions: ResponsiveActionMenuItem[] = [
    { id: 'edit', label: 'Edit meal' },
    { id: 'remove', label: 'Remove from My Meals' },
  ];

  @ViewChild('mealFormContainer') mealFormContainer?: ElementRef<HTMLElement>;

  constructor(
    private mealsService: MealsService,
    private supabaseService: SupabaseService,
    private cdr: ChangeDetectorRef,
    private userStateService: UserStateService
  ) {}

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
    await this.loadMeals();
  }

  async loadMeals(): Promise<void> {
    this.isLoading = true;

    try {
      const user = this.userStateService.getCurrentUser();

      if (!user) {
        this.meals = [];
        return;
      }

      this.meals = await this.mealsService.getMeals(user.id);
    } catch (error) {
      console.error('Error loading meals:', error);
      this.meals = [];
    } finally {
      this.isLoading = false;
      this.cdr.detectChanges();
    }
  }

  get hasMeals(): boolean {
    return this.meals.length > 0;
  }

  trackByMealId(_: number, meal: Meal): string {
    return meal.id;
  }

  startAddMeal(): void {
  this.isAddingMeal = true;
  this.cdr.detectChanges();

  this.isEditingMeal = false;
  this.editingMealId = null;
  this.closeMealMenu();

  this.newMealName = '';
  this.newPrepTime = null;
  this.newIngredientsText = '';
  this.newInstructions = '';
  this.selectedImageFile = null;
  this.selectedImagePreview = null;
}

  cancelMealForm(): void {
    const shouldRestoreToMeal = this.isEditingMeal && !!this.returnToMealId;

    this.isAddingMeal = false;
    this.isEditingMeal = false;
    this.editingMealId = null;

    this.newMealName = '';
    this.newPrepTime = null;
    this.newIngredientsText = '';
    this.newInstructions = '';
    this.selectedImageFile = null;
    this.selectedImagePreview = null;

    this.closeMealMenu();

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
    if (!this.newMealName.trim()) {
      return;
    }

    try {
      let imagePath: string | null = null;

      if (this.selectedImageFile) {
        const extension = this.selectedImageFile.name.split('.').pop() || 'jpg';
        const fileName = `${crypto.randomUUID()}.${extension}`;

        imagePath = await this.supabaseService.uploadMealImage(
          this.selectedImageFile,
          fileName
        );
      }

      await this.mealsService.createMeal(
        this.newMealName.trim(),
        this.newPrepTime,
        this.parseIngredients(this.newIngredientsText),
        imagePath,
        this.newInstructions
      );

      this.cancelMealForm();
      await this.loadMeals();
    } catch (error) {
      console.error('Error saving meal:', error);
    } finally {
      this.cdr.detectChanges();
    }
  }

  async updateMeal(): Promise<void> {
    if (!this.editingMealId || !this.newMealName.trim()) {
      return;
    }

    try {
      let imagePath: string | undefined;

      if (this.selectedImageFile) {
        const extension = this.selectedImageFile.name.split('.').pop() || 'jpg';
        const fileName = `${crypto.randomUUID()}.${extension}`;

        imagePath = await this.supabaseService.uploadMealImage(
          this.selectedImageFile,
          fileName
        );
      }

      await this.mealsService.updateMeal(
        this.editingMealId,
        this.newMealName.trim(),
        this.newPrepTime,
        this.parseIngredients(this.newIngredientsText),
        imagePath,
        this.newInstructions
      );

      this.isAddingMeal = false;
      this.isEditingMeal = false;
      this.editingMealId = null;

      this.newMealName = '';
      this.newPrepTime = null;
      this.newIngredientsText = '';
      this.newInstructions = '';
      this.selectedImageFile = null;
      this.selectedImagePreview = null;

      this.closeMealMenu();

      await this.loadMeals();
      this.restoreToEditedMealCard();
    } catch (error) {
      console.error('Error updating meal:', error);
    } finally {
      this.cdr.detectChanges();
    }
  }

  async onDeleteMeal(meal: Meal): Promise<void> {
    this.closeMealMenu();

    try {
      const user = this.userStateService.getCurrentUser();

      if (!user) {
        return;
      }

      const confirmed = window.confirm(
        `Remove "${meal.name}" from your My Meals?\n\nYou can still access it through other users or past plans.`
      );

      if (!confirmed) {
        return;
      }

      await this.mealsService.hideMealForUser(meal.id, user.id);
      await this.loadMeals();
    } catch (error) {
      console.error('Error hiding meal:', error);
    } finally {
      this.cdr.detectChanges();
    }
  }

  toggleMealMenu(meal: Meal): void {
    const isSameMeal = this.openMealMenuId === meal.id;

    this.openMealMenuId = isSameMeal ? null : meal.id;
    this.selectedMealForActions = isSameMeal ? null : meal;
  }

  closeMealMenu(): void {
    this.openMealMenuId = null;
    this.selectedMealForActions = null;
  }

  async onMealActionSelected(actionId: string): Promise<void> {
    if (!this.selectedMealForActions) {
      return;
    }

    const meal = this.selectedMealForActions;
    this.closeMealMenu();

    switch (actionId) {
      case 'edit':
        this.startEditMeal(meal);
        break;

      case 'remove':
        await this.onDeleteMeal(meal);
        break;

      default:
        break;
    }
  }

  toggleMeal(mealId: string): void {
    this.expandedMealId = this.expandedMealId === mealId ? null : mealId;
  }

  isMobileViewport(): boolean {
    return window.innerWidth < 1024;
  }

  private parseIngredients(value: string): string[] {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }

  private scrollToMealCardInstant(mealId: string): void {
    const card = document.getElementById(`meal-card-${mealId}`);

    if (!card) {
      return;
    }

    const rect = card.getBoundingClientRect();
    const absoluteTop = window.scrollY + rect.top;
    const topOffset = 200;

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

  startEditMeal(meal: Meal): void {
  const currentScrollY = window.scrollY;

  this.isAddingMeal = false;
  this.isEditingMeal = true;
  this.editingMealId = meal.id;
  this.returnToMealId = meal.id;
  this.closeMealMenu();

  this.newMealName = meal.name ?? '';
  this.newPrepTime = meal.prepTime ?? null;
  this.newIngredientsText = (meal.ingredients ?? []).join(', ');
  this.newInstructions = meal.instructions ?? '';

  this.selectedImageFile = null;
  this.selectedImagePreview = meal.image ?? null;

  this.cdr.detectChanges();

  requestAnimationFrame(() => {
    window.scrollTo(0, currentScrollY);
  });
}

  get isSearching(): boolean {
    return !!this.mealSearchQuery.trim();
  }

  get filteredMeals(): Meal[] {
    return filterMealsByQuery(this.meals, this.mealSearchQuery).slice(0, 10);
  }

  selectMealFromSearch(meal: Meal): void {
    this.expandedMealId = meal.id;
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


}