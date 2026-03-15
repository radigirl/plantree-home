import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DayPlan } from '../../models/day-plan.model';
import { PlannedMeal } from '../../models/planned-meal.model';
import { MealPlanService } from '../../services/meal-plan.service';
import { PageLoadingComponent } from '../../shared/components/page-loading/page-loading.component';

@Component({
  selector: 'app-plan',
  standalone: true,
  imports: [CommonModule, PageLoadingComponent],
  templateUrl: './plan.component.html',
  styleUrl: './plan.component.scss',
})
export class PlanComponent implements OnInit {
  weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  weekMeals: DayPlan[] = [];
  isLoading = true;

  constructor(
    private mealPlanService: MealPlanService,
    private cdr: ChangeDetectorRef
  ) {}

  async ngOnInit(): Promise<void> {
    await this.loadWeekPlan();
  }

  async loadWeekPlan(): Promise<void> {
  this.isLoading = true;

  try {
    this.weekMeals = await this.mealPlanService.getWeekPlan();
  } catch (error) {
    console.error('Error loading week plan:', error);
    this.weekMeals = [];
  }

  this.isLoading = false;
  this.cdr.detectChanges();
}

  getFirstMeal(day: DayPlan): PlannedMeal | undefined {
    return day.meals[0];
  }

  getAdditionalMealsCount(day: DayPlan): number {
    return Math.max(day.meals.length - 1, 0);
  }

  hasMeals(day: DayPlan): boolean {
    return day.meals.length > 0;
  }

  getStatusLabel(status: string): string {
    const map: Record<string, string> = {
      'to-prepare': 'To prepare',
      'in-progress': 'In progress',
      'ready-to-serve': 'Ready to serve',
    };

    return map[status] || status;
  }
}