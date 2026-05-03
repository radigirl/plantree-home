import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { DayPlan } from '../../models/day-plan.model';
import { PlannedMeal } from '../../models/planned-meal.model';
import { MealPlanService } from '../../services/meal-plan.service';
import { PageLoadingComponent } from '../../shared/components/page-loading/page-loading.component';
import { getStatusLabel } from '../../shared/utils/meal.utils';
import {
  LucideAngularModule,
  CalendarDays,
  Utensils,
  Trophy,
  ShoppingCart,
  Clock3,
  UserRound
} from 'lucide-angular';
import { SpaceStateService } from '../../services/space.state.service';
import { takeUntil, filter, map, distinctUntilChanged } from 'rxjs/operators';
import { Subject } from 'rxjs';
import { GroceryService } from '../../services/grocery.service';
import { MealsService } from '../../services/meal.service';
import { MemberStateService } from '../../services/member.state.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, PageLoadingComponent, LucideAngularModule],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
})
export class HomeComponent implements OnInit, OnDestroy {
  weekMeals: DayPlan[] = [];
  isLoading = true;
  activeListsCount = 0;
  latestActiveListName = '';
  mealsCount = 0;
  lastAddedMealName = '';
  weekStatsLabel = 'Chef of the week';
  weekStatsDisplayName = '';
  weekStatsCount = 0;

  currentWeekStart: Date = this.getStartOfWeek(new Date());

  readonly planIcon = CalendarDays;
  readonly groceryListsIcon = ShoppingCart;
  readonly myMealsIcon = Utensils;
  readonly statsIcon = Trophy;
  readonly clock3Icon = Clock3;
  readonly userRoundIcon = UserRound;

  private destroy$ = new Subject<void>();

  constructor(
    private router: Router,
    private mealPlanService: MealPlanService,
    private mealsService: MealsService,
    private memberStateService: MemberStateService,
    private spaceStateService: SpaceStateService,
    private groceryService: GroceryService,
    private cdr: ChangeDetectorRef
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
        this.isLoading = true;
        this.cdr.detectChanges();

        await this.loadWeekPlan();
        await this.loadGrocerySummary();
        await this.loadWeekStatsSummary();

        this.isLoading = false;
        this.cdr.detectChanges();
      });

    this.memberStateService.currentMember$
      .pipe(
        takeUntil(this.destroy$),
        filter((member): member is NonNullable<typeof member> => !!member),
        map((member) => member.id),
        distinctUntilChanged()
      )
      .subscribe(async (memberId) => {
        await this.loadMealsSummary(memberId);
      });
  }

  async loadWeekPlan(): Promise<void> {
    try {
      this.weekMeals = await this.mealPlanService.getWeekPlan(this.currentWeekStart);
    } catch (error) {
      console.error('Error loading home week plan:', error);
      this.weekMeals = [];
    }
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

    return getStatusLabel(this.firstTodayMeal.status);
  }

  get additionalMealsCount(): number {
    return Math.max(this.todayMeals.length - 1, 0);
  }

  get plannedMealsCount(): number {
    return this.weekMeals.reduce((total, day) => total + day.meals.length, 0);
  }

  get emptyDaysCount(): number {
    const today = this.formatDateLocal(new Date());

    return this.weekMeals.filter(
      (day) => day.fullDate >= today && day.meals.length === 0
    ).length;
  }

  openToday(): void {
    const today = this.formatDateLocal(new Date());

    this.router.navigate(['/plan/day', today], {
      queryParams: {
        source: 'home',
        ...(this.hasTodayMeals ? {} : { add: 'true' })
      }
    });
  }

  onAddTodayClick(event: MouseEvent): void {
  event.stopPropagation();

  const today = new Date().toISOString().slice(0, 10);

  this.router.navigate(['/plan/day', today], {
    queryParams: {
      add: 'true',
      source: 'home',
    },
  });
}

  openWeekPlan(): void {
    this.router.navigate(['/plan']);
  }

  openGroceryLists(): void {
    this.router.navigate(['/grocery-lists']);
  }

  openWeekStats(): void {
    this.router.navigate(['/week-stats']);
  }

  openCookFromPantry() {
    this.router.navigate(['/cook-from-pantry']);
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

  async loadGrocerySummary(): Promise<void> {
    try {
      const lists = await this.groceryService.getGroceryLists();
      const activeLists = lists.filter(
        (list) => list.status?.toLowerCase() === 'active'
      );
      this.activeListsCount = activeLists.length;
      this.latestActiveListName = activeLists[0]?.name ?? '';

      this.cdr.detectChanges();
    } catch (error) {
      console.error('Error loading grocery summary:', error);
      this.activeListsCount = 0;
      this.latestActiveListName = '';
    }
  }

  async loadMealsSummary(memberId: number): Promise<void> {
    try {
      const meals = await this.mealsService.getMeals(memberId);

      this.mealsCount = meals.length;
      this.lastAddedMealName = meals[0]?.name ?? '';

      this.cdr.detectChanges();
    } catch (error) {
      console.error('Error loading meals summary:', error);
      this.mealsCount = 0;
      this.lastAddedMealName = '';
      this.cdr.detectChanges();
    }
  }

  async loadWeekStatsSummary(): Promise<void> {
    try {
      const cookedMeals = await this.mealPlanService.getCookedMealsForWeek(
        this.currentWeekStart
      );

      const cookedMealsWithCook = cookedMeals.filter((meal) => !!meal.cook);

      this.calculateWeekStatsSummary(cookedMealsWithCook);
    } catch (error) {
      console.error('Error loading home week stats summary:', error);
      this.weekStatsLabel = 'Chef of the week';
      this.weekStatsDisplayName = '';
      this.weekStatsCount = 0;
    }

    this.cdr.detectChanges();
  }

  private calculateWeekStatsSummary(cookedMeals: any[]): void {
    const cookCounts = new Map<number, { name: string; count: number }>();

    for (const meal of cookedMeals) {
      const cook = meal.cook;
      if (!cook) continue;

      const existing = cookCounts.get(cook.id);

      cookCounts.set(cook.id, {
        name: cook.name,
        count: (existing?.count ?? 0) + 1,
      });
    }

    const ranked = Array.from(cookCounts.values()).sort(
      (a, b) => b.count - a.count
    );

    if (ranked.length === 0) {
      this.weekStatsLabel = '';
      this.weekStatsDisplayName = 'No meals cooked yet';
      this.weekStatsCount = 0;
      return;
    }

    const topCount = ranked[0].count;
    const topCooks = ranked.filter((cook) => cook.count === topCount);

    this.weekStatsCount = topCount;

    if (topCooks.length === 1) {
      this.weekStatsLabel = 'Chef of the week:';
      this.weekStatsDisplayName = `${topCooks[0].name} (${topCount})`;
      return;
    }

    this.weekStatsLabel = 'Top cooks:';

    if (topCooks.length === 2) {
      this.weekStatsDisplayName = `${topCooks[0].name} & ${topCooks[1].name} (${topCount})`;
      return;
    }

    this.weekStatsDisplayName = `${topCooks[0].name}, ${topCooks[1].name} +${topCooks.length - 2} (${topCount})`;
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}