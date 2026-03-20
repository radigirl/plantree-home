import {
  ChangeDetectorRef,
  Component,
  ElementRef,
  HostListener,
  OnInit,
} from '@angular/core';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { PlannedMeal } from '../../../models/planned-meal.model';
import { FamilyMember } from '../../../models/family-member.model';

import { MealPlanService } from '../../../services/meal-plan.service';
import { PageLoadingComponent } from '../../../shared/components/page-loading/page-loading.component';
import { UserStateService } from '../../../services/user.state.service';
import { SupabaseService } from '../../../services/supabase.service';

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

  isAddingMeal = false;
  isEditingMeal = false;
  editingPlannedMealId: string | null = null;
  editingMealId: string | null = null;

  newMealName = '';
  newPrepTime: number | null = null;
  selectedCookId: number | null = null;
  availableUsers: FamilyMember[] = [];
  openMealMenuId: string | null = null;

  constructor(
    private route: ActivatedRoute,
    private mealPlanService: MealPlanService,
    private userStateService: UserStateService,
    private supabaseService: SupabaseService,
    private cdr: ChangeDetectorRef,
    private elementRef: ElementRef
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

  startAddMeal(): void {
    if (this.isPastDate()) {
      return;
    }

    this.isAddingMeal = true;
    this.isEditingMeal = false;
    this.editingPlannedMealId = null;
    this.editingMealId = null;
    this.openMealMenuId = null;

    this.newMealName = '';
    this.newPrepTime = null;

    const currentUser = this.userStateService.getCurrentUser();
    this.selectedCookId = currentUser?.id ?? null;
  }

  cancelAddMeal(): void {
    this.isAddingMeal = false;
    this.isEditingMeal = false;
    this.editingPlannedMealId = null;
    this.editingMealId = null;
    this.newMealName = '';
    this.newPrepTime = null;
    this.selectedCookId = null;
    this.openMealMenuId = null;
  }

  async saveMeal(): Promise<void> {
    if (!this.date || !this.newMealName.trim()) {
      return;
    }

    try {
      await this.mealPlanService.createMealAndPlan(
        this.newMealName.trim(),
        this.newPrepTime,
        this.selectedCookId,
        this.date
      );

      this.cancelAddMeal();
      await this.loadMealsForDate(this.date);
    } catch (error) {
      console.error('Error saving meal:', error);
    } finally {
      this.cdr.detectChanges();
    }
  }

  async updateMeal(): Promise<void> {
    if (
      !this.date ||
      !this.editingMealId ||
      !this.editingPlannedMealId ||
      !this.newMealName.trim()
    ) {
      return;
    }

    try {
      await this.mealPlanService.updateMealDetails(
        this.editingMealId,
        this.newMealName.trim(),
        this.newPrepTime
      );

      await this.mealPlanService.updatePlannedMealCook(
        this.editingPlannedMealId,
        this.selectedCookId
      );

      this.cancelAddMeal();
      await this.loadMealsForDate(this.date);
    } catch (error) {
      console.error('Error updating meal:', error);
    } finally {
      this.cdr.detectChanges();
    }
  }

  getStatusLabel(status: string): string {
    const map: Record<string, string> = {
      'to-prepare': 'To prepare',
      'in-progress': 'In progress',
      'ready-to-serve': 'Ready to serve',
    };

    return map[status] || status;
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
      default:
        return null;
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

    let nextStatus: 'in-progress' | 'ready-to-serve' | null = null;

    if (meal.status === 'to-prepare') {
      nextStatus = 'in-progress';
    } else if (meal.status === 'in-progress') {
      nextStatus = 'ready-to-serve';
    }

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

  onEditMeal(meal: PlannedMeal): void {
    if (this.isPastDate()) {
      return;
    }

    this.isAddingMeal = false;
    this.isEditingMeal = true;
    this.editingPlannedMealId = meal.id;
    this.editingMealId = meal.meal.id;
    this.newMealName = meal.meal.name ?? '';
    this.newPrepTime = meal.meal.prepTime ?? null;
    this.selectedCookId = meal.cook?.id ?? null;
    this.closeMealMenu();
  }

  async onDeleteMeal(meal: PlannedMeal): Promise<void> {
  if (!this.date || this.isPastDate()) {
    return;
  }

  const confirmed = window.confirm(
    `Are you sure you want to delete "${meal.meal.name}"?`
  );

  if (!confirmed) {
    return;
  }

  try {
    await this.mealPlanService.deletePlannedMeal(meal.id);
    this.meals = this.meals.filter((item) => item.id !== meal.id);
    this.closeMealMenu();
  } catch (error) {
    console.error('Error deleting meal:', error);
  } finally {
    this.cdr.detectChanges();
  }
}
}