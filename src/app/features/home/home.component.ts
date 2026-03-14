import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { DashboardCardComponent } from '../../shared/components/dashboard-card/dashboard-card.component';
import { Router } from '@angular/router';
import { DayPlan } from '../../models/day-plan.model';
import { PlannedMeal } from '../../models/planned-meal.model';
import { MealPlanService } from '../../services/meal-plan.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, DashboardCardComponent],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
})
export class HomeComponent {
  weekMeals: DayPlan[] = [];

  constructor(
    private router: Router,
    private mealPlanService: MealPlanService
  ) {
    this.weekMeals = this.mealPlanService.getWeekPlan();
  }

  get todayPlan(): DayPlan | undefined {
    return this.weekMeals[0];
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
    this.router.navigate(['/today']);
  }

  openWeekPlan(): void {
    this.router.navigate(['/plan']);
  }

  openGroceryLists(): void {
    this.router.navigate(['/grocery-lists']);
  }

  openWeekStats(): void {
    // TODO: implement stats screen and navigation
    console.log('Week Stats clicked');
  }
}