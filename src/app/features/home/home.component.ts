import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DashboardCardComponent } from '../../shared/components/dashboard-card/dashboard-card.component';
import { Router } from '@angular/router';
import { DayPlan } from '../../models/day-plan.model';
import { PlannedMeal } from '../../models/planned-meal.model';
import { MealPlanService } from '../../services/meal-plan.service';
import { PageLoadingComponent } from '../../shared/components/page-loading/page-loading.component';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, DashboardCardComponent, PageLoadingComponent],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
})
export class HomeComponent implements OnInit {
  weekMeals: DayPlan[] = [];
  isLoading = true;

  currentWeekStart: Date = this.getStartOfWeek(new Date());

  constructor(
    private router: Router,
    private mealPlanService: MealPlanService,
    private cdr: ChangeDetectorRef
  ) {}

  async ngOnInit(): Promise<void> {
    await this.loadWeekPlan();
  }

  async loadWeekPlan(): Promise<void> {
    this.isLoading = true;

    try {
      this.weekMeals = await this.mealPlanService.getWeekPlan(this.currentWeekStart);
    } catch (error) {
      console.error('Error loading home week plan:', error);
      this.weekMeals = [];
    }

    this.isLoading = false;
    this.cdr.detectChanges();
  }

  get todayPlan(): DayPlan | undefined {
    const today = this.formatDateLocal(new Date());
    return this.weekMeals.find((day) => day.fullDate === today);
  }

  get todayMeals(): PlannedMeal[] {
    return this.todayPlan?.meals ?? [];
  }

  get hasTodayMeals(): boolean {
    return this.todayMeals.length > 0;
  }

  get hasMultipleTodayMeals(): boolean {
    return this.todayMeals.length > 1;
  }

  get firstTodayMeal(): PlannedMeal | undefined {
    return this.todayMeals[0];
  }

  get todayStatusLabel(): string {
    if (!this.firstTodayMeal) {
      return '';
    }

    switch (this.firstTodayMeal.status) {
      case 'ready-to-serve':
        return 'Ready to serve';
      case 'in-progress':
        return 'In progress';
      default:
        return 'To prepare';
    }
  }

  get todayStatusClass(): string {
    if (!this.firstTodayMeal) {
      return '';
    }

    switch (this.firstTodayMeal.status) {
      case 'ready-to-serve':
        return 'today-status-badge--ready';
      case 'in-progress':
        return 'today-status-badge--progress';
      default:
        return 'today-status-badge--pending';
    }
  }

  get additionalMealsCount(): number {
    return Math.max(this.todayMeals.length - 1, 0);
  }

  get plannedMealsCount(): number {
    return this.weekMeals.reduce((total, day) => total + day.meals.length, 0);
  }

  get emptyDaysCount(): number {
    return this.weekMeals.filter((day) => day.meals.length === 0).length;
  }

  openToday(): void {
    const today = this.formatDateLocal(new Date());
    this.router.navigate(['/plan/day', today]);
  }

  openWeekPlan(): void {
    this.router.navigate(['/plan']);
  }

  openGroceryLists(): void {
    this.router.navigate(['/grocery-lists']);
  }

  openWeekStats(): void {
    console.log('Week Stats clicked');
  }

  getStartOfWeek(date: Date): Date {
    const result = new Date(date);
    const day = result.getDay();
    const diff = day === 0 ? -6 : 1 - day;

    result.setDate(result.getDate() + diff);
    result.setHours(0, 0, 0, 0);

    return result;
  }

  private formatDateLocal(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  }

  openMeals(): void {
  this.router.navigate(['/meals']);
}

}