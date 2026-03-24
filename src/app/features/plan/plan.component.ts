import {
  ChangeDetectorRef,
  Component,
  ElementRef,
  OnInit,
  QueryList,
  ViewChildren,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { DayPlan } from '../../models/day-plan.model';
import { PlannedMeal } from '../../models/planned-meal.model';
import { MealPlanService } from '../../services/meal-plan.service';
import { PageLoadingComponent } from '../../shared/components/page-loading/page-loading.component';

@Component({
  selector: 'app-plan',
  standalone: true,
  imports: [CommonModule, RouterModule, PageLoadingComponent],
  templateUrl: './plan.component.html',
  styleUrl: './plan.component.scss',
})
export class PlanComponent implements OnInit {
  weekMeals: DayPlan[] = [];
  isLoading = true;
  currentWeekStart: Date = this.getStartOfWeek(new Date());
  @ViewChild('datePicker') datePicker!: ElementRef<HTMLInputElement>;


  @ViewChildren('mealCard') mealCards!: QueryList<ElementRef<HTMLElement>>;

  constructor(
    private mealPlanService: MealPlanService,
    private cdr: ChangeDetectorRef,
    private router: Router
  ) { }

  async ngOnInit(): Promise<void> {
    await this.loadWeekPlan(window.innerWidth < 768);
  }


  async loadWeekPlan(scrollToTodayAfterLoad = false): Promise<void> {
    this.isLoading = true;

    try {
      const data = await this.mealPlanService.getWeekPlan(this.currentWeekStart);
      this.weekMeals = data;
    } catch (error) {
      console.error('Error loading week plan:', error);
      this.weekMeals = [];
    }

    this.isLoading = false;
    this.cdr.detectChanges();

    if (scrollToTodayAfterLoad) {
      setTimeout(() => {
        const todayIndex = this.getTodayIndexInCurrentWeek();
        if (todayIndex !== -1) {
          this.scrollToDay(todayIndex);
        }
      }, 50);
    }
  }

  onAddMealClick(event: MouseEvent, date: string): void {
    event.stopPropagation();

    this.router.navigate(['/plan/day', date], {
      queryParams: {
        add: 'true',
        source: 'plan'
      }
    });
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
      'ready-to-serve': 'Ready',
    };

    return map[status] || status;
  }

  getStartOfWeek(date: Date): Date {
    const result = new Date(date);
    const day = result.getDay();
    const diff = day === 0 ? -6 : 1 - day;

    result.setDate(result.getDate() + diff);
    result.setHours(0, 0, 0, 0);

    return result;
  }

  async goToPreviousWeek(): Promise<void> {
    const previousWeek = new Date(this.currentWeekStart);
    previousWeek.setDate(previousWeek.getDate() - 7);
    previousWeek.setHours(0, 0, 0, 0);
    this.currentWeekStart = previousWeek;

    await this.loadWeekPlan(false);
  }

  async goToNextWeek(): Promise<void> {
    const nextWeek = new Date(this.currentWeekStart);
    nextWeek.setDate(nextWeek.getDate() + 7);
    nextWeek.setHours(0, 0, 0, 0);
    this.currentWeekStart = nextWeek;

    await this.loadWeekPlan(false);
  }

  async goToToday(): Promise<void> {
    const todayWeekStart = this.getStartOfWeek(new Date());
    const sameWeek =
      todayWeekStart.getTime() === this.currentWeekStart.getTime();

    if (!sameWeek) {
      this.currentWeekStart = todayWeekStart;
      await this.loadWeekPlan(false);
    }

    setTimeout(() => {
      const todayIndex = this.getTodayIndexInCurrentWeek();
      if (todayIndex !== -1) {
        this.scrollToDay(todayIndex);
      }
    }, 50);
  }

  getWeekLabel(): string {
    const start = new Date(this.currentWeekStart);
    const end = new Date(this.currentWeekStart);
    end.setDate(start.getDate() + 6);

    const startMonth = start.toLocaleDateString('en-US', { month: 'short' });
    const endMonth = end.toLocaleDateString('en-US', { month: 'short' });

    if (startMonth === endMonth) {
      return `${startMonth} ${start.getDate()}–${end.getDate()}`;
    }

    return `${startMonth} ${start.getDate()} – ${endMonth} ${end.getDate()}`;
  }

  scrollToDay(index: number): void {
  const card = this.mealCards?.toArray()[index]?.nativeElement;

  if (!card) return;

  const cardRect = card.getBoundingClientRect();
  const absoluteTop = window.scrollY + cardRect.top;

  const TOP_OFFSET = window.innerWidth < 768 ? 90 : 120;

  window.scrollTo({
    top: Math.max(absoluteTop - TOP_OFFSET, 0),
    behavior: 'smooth',
  });
}

  openDatePicker(): void {
  const input = this.datePicker?.nativeElement as HTMLInputElement;
  if (!input) return;

  if ((input as any).showPicker) {
    (input as any).showPicker();
  } else {
    input.click();
  }
}

  getCurrentDateInputValue(): string {
    const current = new Date(this.currentWeekStart);
    return this.formatDateForInput(current);
  }

  async onDatePicked(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (!input.value) return;

    const pickedDate = new Date(`${input.value}T00:00:00`);
    this.currentWeekStart = this.getStartOfWeek(pickedDate);

    await this.loadWeekPlan(false);

    setTimeout(() => {
      const pickedIndex = this.getDayIndexInCurrentWeek(pickedDate);
      if (pickedIndex !== -1) {
        this.scrollToDay(pickedIndex);
      }
    }, 50);
  }

  private formatDateForInput(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  }

  private getDayIndexInCurrentWeek(date: Date): number {
    const target = new Date(date);
    target.setHours(0, 0, 0, 0);

    for (let i = 0; i < this.weekMeals.length; i++) {
      const itemDate = new Date(this.currentWeekStart);
      itemDate.setDate(this.currentWeekStart.getDate() + i);
      itemDate.setHours(0, 0, 0, 0);

      if (itemDate.getTime() === target.getTime()) {
        return i;
      }
    }

    return -1;
  }

  isTodayIndex(index: number): boolean {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const itemDate = new Date(this.currentWeekStart);
    itemDate.setDate(this.currentWeekStart.getDate() + index);
    itemDate.setHours(0, 0, 0, 0);

    return itemDate.getTime() === today.getTime();
  }

  isPastDayIndex(index: number): boolean {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const itemDate = new Date(this.currentWeekStart);
    itemDate.setDate(this.currentWeekStart.getDate() + index);
    itemDate.setHours(0, 0, 0, 0);

    return itemDate.getTime() < today.getTime();
  }

  private getTodayIndexInCurrentWeek(): number {
    for (let i = 0; i < this.weekMeals.length; i++) {
      if (this.isTodayIndex(i)) {
        return i;
      }
    }

    return -1;
  }
}