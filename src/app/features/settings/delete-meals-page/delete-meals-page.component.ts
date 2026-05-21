import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component } from '@angular/core';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { ConfirmationDialogComponent } from '../../../shared/components/confirmation-dialog/confirmation-dialog.component';
import { SnackbarComponent } from '../../../shared/components/snackbar/snackbar.component';
import { Meal } from '../../../models/meal.model';
import { MealsService } from '../../../services/meal.service';
import { LucideAngularModule, Clock3 } from 'lucide-angular';

@Component({
  selector: 'app-delete-meals-page',
  standalone: true,
  imports: [
    CommonModule,
    TranslatePipe,
    ConfirmationDialogComponent,
    SnackbarComponent,
    LucideAngularModule
  ],
  templateUrl: './delete-meals-page.component.html',
  styleUrls: ['./delete-meals-page.component.scss'],
})
export class DeleteMealsPageComponent {
  meals: Meal[] = [];

  selectedMeal: Meal | null = null;

  toastMessage = '';
  isToastVisible = false;

  private toastTimeout: ReturnType<typeof setTimeout> | null = null;
  readonly clock3Icon = Clock3;

  constructor(
    private mealsService: MealsService,
    private cdr: ChangeDetectorRef
  ) { }

  async ngOnInit(): Promise<void> {
    await this.loadMeals();
  }

  async loadMeals(): Promise<void> {
  try {
    this.meals = await this.mealsService.getAllMeals();
  } catch (error) {
    console.error('Error loading meals:', error);
    this.meals = [];
  } finally {
    this.cdr.detectChanges();
  }
}

  onMealClick(meal: Meal): void {
    this.selectedMeal = meal;
  }

  cancelDelete(): void {
    this.selectedMeal = null;
  }

  async confirmDelete(): Promise<void> {
    const meal = this.selectedMeal;

    if (!meal) {
      return;
    }

    this.selectedMeal = null;
    this.cdr.detectChanges();

    try {
      await this.mealsService.deleteMealEverywhere(meal.id);

      this.meals = this.meals.filter(
        (existingMeal) => existingMeal.id !== meal.id
      );

      this.showToast('Meal deleted');
    } catch (error) {
      console.error('Error deleting meal:', error);
    }
  }

  showToast(message: string): void {
    this.toastMessage = message;
    this.isToastVisible = true;

    if (this.toastTimeout) {
      clearTimeout(this.toastTimeout);
    }

    this.toastTimeout = setTimeout(() => {
      this.isToastVisible = false;
      this.toastMessage = '';
      this.cdr.detectChanges();
    }, 2500);

    this.cdr.detectChanges();
  }

}