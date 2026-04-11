import {
  ChangeDetectorRef,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  QueryList,
  ViewChildren,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { DayPlan } from '../../models/day-plan.model';
import { PlannedMeal } from '../../models/planned-meal.model';
import { MealPlanService } from '../../services/meal-plan.service';
import { PageLoadingComponent } from '../../shared/components/page-loading/page-loading.component';
import { CalendarPickerComponent } from '../../shared/components/calendar-picker/calendar-picker.component';
import {
  LucideAngularModule,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  ShoppingCart
} from 'lucide-angular';
import { SpaceStateService } from '../../services/space.state.service';
import { Subject } from 'rxjs';
import { filter, map, distinctUntilChanged, takeUntil } from 'rxjs/operators';


@Component({
  selector: 'app-plan',
  standalone: true,
  imports: [CommonModule, RouterModule, PageLoadingComponent, CalendarPickerComponent, LucideAngularModule],
  templateUrl: './plan.component.html',
  styleUrl: './plan.component.scss',
})
export class PlanComponent implements OnInit, OnDestroy {
  weekMeals: DayPlan[] = [];
  isLoading = true;
  isReady = false; // when returning from details
  currentWeekStart: Date = this.getStartOfWeek(new Date());

  isCalendarOpen = false;
  selectedCalendarDates: string[] = [];

  readonly chevronLeftIcon = ChevronLeft;
  readonly chevronRightIcon = ChevronRight;
  readonly calendarIcon = CalendarDays;
  readonly groceryListsIcon = ShoppingCart;

  private destroy$ = new Subject<void>();


  @ViewChildren('mealCard') mealCards!: QueryList<ElementRef<HTMLElement>>;

  constructor(
    private mealPlanService: MealPlanService,
    private spaceStateService: SpaceStateService,
    private cdr: ChangeDetectorRef,
    private router: Router
  ) { }

   ngOnInit(): void {
  this.spaceStateService.currentSpace$
    .pipe(
      takeUntil(this.destroy$),
      filter((space): space is NonNullable<typeof space> => !!space),
      map((space) => space.id),
      distinctUntilChanged()
    )
    .subscribe(async () => {
      await this.initializePlanForCurrentSpace();
    });
}

  private async initializePlanForCurrentSpace(): Promise<void> {
    const returnDate = sessionStorage.getItem('planReturnDate');

    if (returnDate) {
      this.currentWeekStart = this.getStartOfWeek(new Date(returnDate));
    }

    await this.loadWeekPlan(false);

    if (returnDate) {
      setTimeout(() => {
        const returnIndex = this.getDayIndexFromDateString(returnDate);
        if (returnIndex !== -1) {
          this.scrollToDayInstant(returnIndex);
        }

        sessionStorage.removeItem('planReturnDate');
      }, 0);
    }
  }

  openDayDetails(date: string): void {
    sessionStorage.setItem('planReturnDate', date);
    this.router.navigate(['/plan/day', date], {
      queryParams: {
        source: 'plan'
      }
    });
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

  private getDayIndexFromDateString(dateString: string): number {
    const target = new Date(dateString);
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

  get hasMealsInSelectedWeek(): boolean {
  return this.weekMeals.some(day => day.meals.length > 0);
}

generateWeeklyList(): void {
  console.log('Generate weekly list clicked');

  // later:
  // navigate to lists or trigger generation
  // this.router.navigate(['/lists']);
}

  scrollToDay(index: number): void {
    const card = this.mealCards?.toArray()[index]?.nativeElement;

    if (!card) return;

    const cardRect = card.getBoundingClientRect();
    const absoluteTop = window.scrollY + cardRect.top;
    const topOffset = 200;

    window.scrollTo({
      top: Math.max(absoluteTop - topOffset, 0),
      behavior: 'smooth',
    });
  }

  scrollToDayInstant(index: number): void {
    const card = this.mealCards?.toArray()[index]?.nativeElement;

    if (!card) return;

    const cardRect = card.getBoundingClientRect();
    const absoluteTop = window.scrollY + cardRect.top;
    const topOffset = 200;

    window.scrollTo(0, Math.max(absoluteTop - topOffset, 0));
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

  openCalendar(): void {
    this.isCalendarOpen = true;
    this.selectedCalendarDates = [this.formatDateForInput(this.currentWeekStart)];
    document.body.style.overflow = 'hidden';
  }

  closeCalendar(): void {
    this.isCalendarOpen = false;
    this.selectedCalendarDates = [];
    document.body.style.overflow = '';
  }

  onCalendarDatesChange(dates: string[]): void {
    this.selectedCalendarDates = dates;
  }

  async confirmCalendarDates(dates: string[]): Promise<void> {
    if (!dates.length) {
      return;
    }

    const pickedDate = new Date(`${dates[0]}T12:00:00`);
    const pickedWeekStart = this.getStartOfWeek(pickedDate);

    // let the selected state be visible briefly
    await new Promise((resolve) => setTimeout(resolve, 160));

    this.closeCalendar();

    this.currentWeekStart = pickedWeekStart;
    await this.loadWeekPlan(false);

    requestAnimationFrame(() => {
      const pickedIndex = this.getDayIndexInCurrentWeek(pickedDate);
      if (pickedIndex !== -1) {
        this.scrollToDayInstant(pickedIndex);
      }
    });
  }

  isViewingCurrentWeek(): boolean {
    const today = new Date();
    const todayWeekStart = this.getStartOfWeek(today);

    return this.formatDateForInput(this.currentWeekStart) === this.formatDateForInput(todayWeekStart);
  }

  ngOnDestroy(): void {
  this.destroy$.next();
  this.destroy$.complete();
}

}