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
import { GenerateSheetListComponent } from './generate-list-sheet/generate-sheet-list.component';
import { GroceryService } from '../../services/grocery.service';
import { MemberStateService } from '../../services/member.state.service';


@Component({
  selector: 'app-plan',
  standalone: true,
  imports: [CommonModule, RouterModule, PageLoadingComponent, CalendarPickerComponent, LucideAngularModule, GenerateSheetListComponent],
  templateUrl: './plan.component.html',
  styleUrl: './plan.component.scss',
})
export class PlanComponent implements OnInit, OnDestroy {
  weekMeals: DayPlan[] = [];
  isLoading = true;
  isReady = false; // when returning from details
  currentWeekStart: Date = this.getStartOfWeek(new Date());
  selectedDayIndex: number | null = null;

  isCalendarOpen = false;
  selectedCalendarDates: string[] = [];
  isGenerateSheetOpen = false;

  generateSheetDays: any[] = [];

  readonly chevronLeftIcon = ChevronLeft;
  readonly chevronRightIcon = ChevronRight;
  readonly calendarIcon = CalendarDays;
  readonly groceryListsIcon = ShoppingCart;

  private destroy$ = new Subject<void>();


  @ViewChildren('mealCard') mealCards!: QueryList<ElementRef<HTMLElement>>;
  @ViewChildren('dayBtn') dayButtons!: QueryList<ElementRef<HTMLElement>>;

  constructor(
    private mealPlanService: MealPlanService,
    private spaceStateService: SpaceStateService,
    private cdr: ChangeDetectorRef,
    private router: Router,
    private groceryService: GroceryService,
    private memberStateService: MemberStateService
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
          this.selectedDayIndex = returnIndex;
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
      this.buildGenerateSheetDays();
      const todayIndex = this.getTodayIndexInCurrentWeek();
      this.selectedDayIndex = todayIndex !== -1 ? todayIndex : null;
    } catch (error) {
      console.error('Error loading week plan:', error);
      this.weekMeals = [];
      this.generateSheetDays = [];
    }

    this.isLoading = false;
    this.cdr.detectChanges();
    setTimeout(() => {
      this.scrollStripToToday();
    });

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
        this.selectedDayIndex = todayIndex;
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
    this.isGenerateSheetOpen = true;
  }

  closeGenerateSheet(): void {
    this.isGenerateSheetOpen = false;
  }

  async onQuickGenerateList(): Promise<void> {
  const selectedDayKeys = this.generateSheetDays.map((day) => day.key);
  const selectedMealIds = this.generateSheetDays.flatMap((day) =>
    day.meals.map((meal: any) => meal.id)
  );
  this.isGenerateSheetOpen = false;
  await this.createGeneratedListFromSelection(selectedDayKeys, selectedMealIds);
}

  async onGenerateSelectedList(selection: {
  selectedDayKeys: string[];
  selectedMealIds: string[];
}): Promise<void> {
  this.isGenerateSheetOpen = false;

  await this.createGeneratedListFromSelection(
    selection.selectedDayKeys,
    selection.selectedMealIds
  );
}

  scrollToDay(index: number): void {
    this.selectedDayIndex = index;
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

  // for week strip
  private scrollStripToToday(): void {
    const todayIndex = this.getTodayIndexInCurrentWeek();
    if (todayIndex === -1) return;

    const el = this.dayButtons?.toArray()[todayIndex]?.nativeElement;
    if (!el) return;

    el.scrollIntoView({
      behavior: 'auto',
      inline: 'center',
      block: 'nearest',
    });
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

  isPastWeek(): boolean {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const endOfWeek = new Date(this.currentWeekStart);
    endOfWeek.setDate(this.currentWeekStart.getDate() + 6);
    endOfWeek.setHours(0, 0, 0, 0);

    return endOfWeek < today;
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
        this.selectedDayIndex = pickedIndex;
        this.scrollToDayInstant(pickedIndex);
      }
    });
  }

  isViewingCurrentWeek(): boolean {
    const today = new Date();
    const todayWeekStart = this.getStartOfWeek(today);

    return this.formatDateForInput(this.currentWeekStart) === this.formatDateForInput(todayWeekStart);
  }

  private buildGenerateSheetDays(): void {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    this.generateSheetDays = this.weekMeals
      .map((day, index) => {
        const itemDate = new Date(this.currentWeekStart);
        itemDate.setDate(this.currentWeekStart.getDate() + index);
        itemDate.setHours(0, 0, 0, 0);

        return {
          key: this.formatDateForInput(itemDate),
          label: day.day,
          date: day.date,
          isToday: itemDate.getTime() === today.getTime(),
          isPast: itemDate.getTime() < today.getTime(),
          meals: day.meals.map((meal, mealIndex) => ({
            id: String(meal.meal?.id),
            name: meal.meal?.name || 'Untitled meal',
          })),
        };
      })
      .filter((day) => !day.isPast && day.meals.length > 0);
  }

  private getIngredientsFromSelectedMealIds(selectedMealIds: string[]): string[] {
  const ingredients: string[] = [];
  for (const day of this.weekMeals) {
    for (const plannedMeal of day.meals) {
      const mealId = String(plannedMeal.meal?.id);
      if (!selectedMealIds.includes(mealId)) {
        continue;
      }
      const mealIngredients = Array.isArray(plannedMeal.meal?.ingredients)
        ? plannedMeal.meal.ingredients
        : [];
      for (const ingredient of mealIngredients) {
        const cleaned = typeof ingredient === 'string' ? ingredient.trim() : '';
        if (cleaned) {
          ingredients.push(cleaned);
        }
      }
    }
  }

  return ingredients;
}

private buildGeneratedListName(selectedDayKeys: string[]): string {
  if (!selectedDayKeys.length) {
    return 'Plan list';
  }
  const sortedKeys = [...selectedDayKeys].sort();
  const first = new Date(`${sortedKeys[0]}T12:00:00`);
  const last = new Date(`${sortedKeys[sortedKeys.length - 1]}T12:00:00`);
  const formatDay = (date: Date): string =>
    date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  return `Plan list ${formatDay(first)}–${formatDay(last)}`;
}

private async createGeneratedListFromSelection(
  selectedDayKeys: string[],
  selectedMealIds: string[]
): Promise<void> {
  const currentMember = this.memberStateService.getCurrentMember();

  if (!currentMember) {
    console.error('No current member selected');
    return;
  }
  const ingredients = this.getIngredientsFromSelectedMealIds(selectedMealIds);
  if (!ingredients.length) {
    console.warn('No ingredients found for selected meals');
    return;
  }
  const listName = this.buildGeneratedListName(selectedDayKeys);
  const createdList = await this.groceryService.createGroceryList(
    listName,
    currentMember.id,
    true
  );
  if (!createdList) {
    console.error('Failed to create generated grocery list');
    return;
  }
  for (const ingredient of ingredients) {
    await this.groceryService.createGroceryItem(
      createdList.id,
      ingredient,
      currentMember.id
    );
  }
  console.log('Generated list created:', createdList.name, ingredients);
}

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

}