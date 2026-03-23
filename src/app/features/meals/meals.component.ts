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

@Component({
  selector: 'app-meals',
  standalone: true,
  imports: [CommonModule, FormsModule, PageLoadingComponent],
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

  @ViewChild('mealFormContainer') mealFormContainer?: ElementRef<HTMLElement>;

  constructor(
    private mealsService: MealsService,
    private supabaseService: SupabaseService,
    private cdr: ChangeDetectorRef,
    private userStateService: UserStateService,
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
    this.isEditingMeal = false;
    this.editingMealId = null;
    this.openMealMenuId = null;

    this.newMealName = '';
    this.newPrepTime = null;
    this.newIngredientsText = '';
    this.selectedImageFile = null;
    this.selectedImagePreview = null;
    this.newInstructions = '';

    this.scrollFormIntoView();
  }

  cancelMealForm(): void {
    this.isAddingMeal = false;
    this.isEditingMeal = false;
    this.editingMealId = null;

    this.newMealName = '';
    this.newPrepTime = null;
    this.newIngredientsText = '';

    this.selectedImageFile = null;
    this.selectedImagePreview = null;

    this.openMealMenuId = null;
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

    if (!this.isEditingMeal) {
      this.selectedImagePreview = null;
    }
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

      this.cancelMealForm();
      await this.loadMeals();
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
      if (!user) return;

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

  toggleMealMenu(mealId: string): void {
    this.openMealMenuId = this.openMealMenuId === mealId ? null : mealId;
  }

  toggleMeal(mealId: string): void {
    this.expandedMealId = this.expandedMealId === mealId ? null : mealId;
  }

  closeMealMenu(): void {
    this.openMealMenuId = null;
  }

  private parseIngredients(value: string): string[] {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }

  private scrollFormIntoView(): void {
    setTimeout(() => {
      this.mealFormContainer?.nativeElement.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }, 0);
  }

  startEditMeal(meal: Meal): void {
    this.isAddingMeal = false;
    this.isEditingMeal = true;
    this.editingMealId = meal.id;
    this.openMealMenuId = null;

    this.newMealName = meal.name ?? '';
    this.newPrepTime = meal.prepTime ?? null;
    this.newIngredientsText = (meal.ingredients ?? []).join(', ');
    this.newInstructions = meal.instructions ?? '';

    this.selectedImageFile = null;
    this.selectedImagePreview = meal.image ?? null;

    this.scrollFormIntoView();
  }


}