import { CommonModule } from '@angular/common';
import {
  ChangeDetectorRef,
  Component,
  OnInit,
} from '@angular/core';
import { PageLoadingComponent } from '../../shared/components/page-loading/page-loading.component';
import { MealPlanService } from '../../services/meal-plan.service';
import { OnDestroy } from '@angular/core';
import { Subject } from 'rxjs';
import { takeUntil, filter, map, distinctUntilChanged } from 'rxjs/operators';
import { SpaceStateService } from '../../services/space.state.service';

@Component({
  selector: 'app-week-stats',
  standalone: true,
  imports: [CommonModule, PageLoadingComponent],
  templateUrl: './week-stats.component.html',
  styleUrls: ['./week-stats.component.scss'],
})
export class WeekStatsComponent implements OnInit, OnDestroy {
  isLoading = true;

  winnerName = '';
  winnerCount = 0;
  isTie = false;
  currentWeekStart: Date = this.getStartOfWeek(new Date());
  chefLabel = 'Chef of the week';
  chefDisplayName = '';

  cookedMeals: {
    name: string;
    cook: string;
    completedAt: string;
  }[] = [];
  activeCooksCount = 0;

  private destroy$ = new Subject<void>();

  constructor(
    private mealPlanService: MealPlanService,
    private spaceStateService: SpaceStateService,
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
        await this.loadStats();
      });
  }

  async loadStats(): Promise<void> {
    this.isLoading = true;

    try {
      const cookedMeals = await this.mealPlanService.getCookedMealsForWeek(
        this.currentWeekStart
      );

      const cookedMealsWithCook = cookedMeals.filter(
        (plannedMeal) => !!plannedMeal.cook
      );

      this.activeCooksCount = new Set(
        cookedMealsWithCook.map((plannedMeal) => plannedMeal.cook?.id)
      ).size;

      this.cookedMeals = cookedMeals.map((plannedMeal) => ({
        name: plannedMeal.meal.name,
        cook: plannedMeal.cook?.name ?? 'Unknown',
        completedAt: plannedMeal.completed_at ?? '',
      }));

      this.calculateChefOfTheWeek(cookedMealsWithCook);
    } catch (error) {
      console.error('Error loading week stats:', error);

      this.winnerName = '';
      this.winnerCount = 0;
      this.isTie = false;
      this.chefLabel = 'Chef of the week';
      this.chefDisplayName = '';
      this.cookedMeals = [];
      this.activeCooksCount = 0;
    }

    this.isLoading = false;
    this.cdr.detectChanges();
  }

  private calculateChefOfTheWeek(cookedMeals: any[]): void {
    const cookCounts = new Map<number, { name: string; count: number }>();

    for (const plannedMeal of cookedMeals) {
      const cook = plannedMeal.cook;

      if (!cook) {
        continue;
      }

      const existing = cookCounts.get(cook.id);

      cookCounts.set(cook.id, {
        name: cook.name,
        count: (existing?.count ?? 0) + 1,
      });
    }

    const rankedCooks = Array.from(cookCounts.values()).sort(
      (a, b) => b.count - a.count
    );

    if (rankedCooks.length === 0) {
      this.winnerName = '';
      this.winnerCount = 0;
      this.isTie = false;
      this.chefLabel = 'Chef of the week';
      this.chefDisplayName = '';
      return;
    }

    const topCount = rankedCooks[0].count;
    const topCooks = rankedCooks.filter((cook) => cook.count === topCount);

    this.winnerCount = topCount;
    this.isTie = topCooks.length > 1;

    if (!this.isTie) {
      this.chefLabel = 'Chef of the week';
      this.winnerName = topCooks[0].name;
      this.chefDisplayName = `${topCooks[0].name} (${topCount})`;
      return;
    }

    this.chefLabel = 'Top cooks';

    if (topCooks.length === 2) {
      this.chefDisplayName = `${topCooks[0].name} & ${topCooks[1].name} (${topCount})`;
      return;
    }

    const extraCount = topCooks.length - 2;
    this.chefDisplayName = `${topCooks[0].name}, ${topCooks[1].name} +${extraCount} (${topCount})`;
  }

  getStartOfWeek(date: Date): Date {
    const result = new Date(date);
    const day = result.getDay();
    const diff = day === 0 ? -6 : 1 - day;

    result.setDate(result.getDate() + diff);
    result.setHours(0, 0, 0, 0);

    return result;
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

}