import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
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
  newMealName = '';
  newPrepTime: number | null = null;
  selectedCookId: number | null = null;
  availableUsers: FamilyMember[] = [];

  constructor(
    private route: ActivatedRoute,
    private mealPlanService: MealPlanService,
    private userStateService: UserStateService,
    private supabaseService: SupabaseService,
    private cdr: ChangeDetectorRef
  ) {}

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
    this.newMealName = '';
    this.newPrepTime = null;

    const currentUser = this.userStateService.getCurrentUser();
    this.selectedCookId = currentUser?.id ?? null;
  }

  cancelAddMeal(): void {
    this.isAddingMeal = false;
    this.newMealName = '';
    this.newPrepTime = null;
    this.selectedCookId = null;
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
}