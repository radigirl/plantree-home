import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';

import { MealPlanService } from '../../services/meal-plan.service';
import { MealsService } from '../../services/meal.service';
import { SupabaseService } from '../../services/supabase.service';
import { PageLoadingComponent } from '../../shared/components/page-loading/page-loading.component';

@Component({
  selector: 'app-meal-details',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, PageLoadingComponent],
  templateUrl: './meal-details.component.html',
  styleUrl: './meal-details.component.scss',
})
export class MealDetailsComponent implements OnInit {
  mealId: string | null = null;
  source: string | null = null;
  editInstructions = '';

  meal: {
    id: string;
    name: string;
    prepTime?: number;
    ingredients?: string[];
    image?: string;
    instructions?: string;
  } | null = null;

  isLoading = true;
  isEditing = false;

  editMealName = '';
  editPrepTime: number | null = null;
  editIngredientsText = '';

  selectedImageFile: File | null = null;
  selectedImagePreview: string | null = null;

  constructor(
    private route: ActivatedRoute,
    private mealPlanService: MealPlanService,
    private mealsService: MealsService,
    private supabaseService: SupabaseService,
    private cdr: ChangeDetectorRef
  ) {}

  async ngOnInit(): Promise<void> {
    this.mealId = this.route.snapshot.paramMap.get('id');
    this.source = this.route.snapshot.queryParamMap.get('source');

    if (!this.mealId) {
      this.isLoading = false;
      this.cdr.detectChanges();
      return;
    }

    await this.loadMeal();
  }

  async loadMeal(): Promise<void> {
    if (!this.mealId) {
      this.isLoading = false;
      this.cdr.detectChanges();
      return;
    }

    this.isLoading = true;

    try {
      this.meal = await this.mealPlanService.getMealById(this.mealId);

      if (this.meal) {
        this.editMealName = this.meal.name ?? '';
        this.editPrepTime = this.meal.prepTime ?? null;
        this.editIngredientsText = (this.meal.ingredients ?? []).join(', ');
        this.selectedImagePreview = this.meal.image ?? null;
        this.editInstructions = this.meal.instructions ?? '';
      }
    } catch (error) {
      console.error('Error loading meal details:', error);
      this.meal = null;
    } finally {
      this.isLoading = false;
      this.cdr.detectChanges();
    }
  }

  get backLink(): string {
    if (this.source === 'my-meals') {
      return '/meals';
    }

    return '/plan';
  }

  get canEdit(): boolean {
    return this.source === 'my-meals';
  }

  startEdit(): void {
    if (!this.meal || !this.canEdit) {
      return;
    }

    this.isEditing = true;
    this.editMealName = this.meal.name ?? '';
    this.editPrepTime = this.meal.prepTime ?? null;
    this.editIngredientsText = (this.meal.ingredients ?? []).join(', ');
    this.selectedImageFile = null;
    this.selectedImagePreview = this.meal.image ?? null;
    this.editInstructions = this.meal.instructions ?? '';
  }

  cancelEdit(): void {
    this.isEditing = false;
    this.selectedImageFile = null;
    this.selectedImagePreview = this.meal?.image ?? null;
    this.editMealName = this.meal?.name ?? '';
    this.editPrepTime = this.meal?.prepTime ?? null;
    this.editIngredientsText = (this.meal?.ingredients ?? []).join(', ');
    this.editInstructions = this.meal?.instructions ?? '';
  }

  onMealImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;

    if (!file) {
      this.selectedImageFile = null;
      this.selectedImagePreview = this.meal?.image ?? null;
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
    if (!this.mealId || !this.editMealName.trim()) {
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
        this.mealId,
        this.editMealName.trim(),
        this.editPrepTime,
        this.parseIngredients(this.editIngredientsText),
        imagePath,
        this.editInstructions
      );

      this.isEditing = false;
      await this.loadMeal();
    } catch (error) {
      console.error('Error saving meal details:', error);
    } finally {
      this.cdr.detectChanges();
    }
  }

  private parseIngredients(value: string): string[] {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }
}