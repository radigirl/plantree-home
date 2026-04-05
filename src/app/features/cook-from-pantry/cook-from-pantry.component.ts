import {
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject } from 'rxjs';
import {
  distinctUntilChanged,
  filter,
  map,
  takeUntil,
} from 'rxjs/operators';

import { PageLoadingComponent } from '../../shared/components/page-loading/page-loading.component';
import { MealsService } from '../../services/meal.service';
import { PantryService } from '../../services/pantry.service';
import { SpaceStateService } from '../../services/space.state.service';
import { MemberStateService } from '../../services/member.state.service';

import { Meal } from '../../models/meal.model';
import { PantryItem } from '../../models/pantry-item.model';
import { AlwaysPresentPantryItem } from '../../models/always-present-pantry-item.model';

type EmptyState =
  | 'none'
  | 'no-meals'
  | 'empty-pantry'
  | 'both-empty';

interface CookFromPantryMeal extends Meal {
  score: number;
  matchedCount: number;
  totalCount: number;
}

@Component({
  selector: 'app-cook-from-pantry',
  standalone: true,
  imports: [CommonModule, PageLoadingComponent],
  templateUrl: './cook-from-pantry.component.html',
  styleUrl: './cook-from-pantry.component.scss',
})
export class CookFromPantryComponent
  implements OnInit, OnDestroy {
  isLoading = true;
  emptyState: EmptyState = 'none';

  sortedMeals: CookFromPantryMeal[] = [];

  private destroy$ = new Subject<void>();

  constructor(
    private mealsService: MealsService,
    private pantryService: PantryService,
    private spaceStateService: SpaceStateService,
    private memberStateService: MemberStateService,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    this.spaceStateService.currentSpace$
      .pipe(
        takeUntil(this.destroy$),
        filter((space): space is NonNullable<typeof space> => !!space),
        distinctUntilChanged((prev, curr) => prev.id === curr.id)
      )
      .subscribe(async (space) => {
        await this.loadSuggestions(space.id);
      });
  }

  private async loadSuggestions(spaceId: string): Promise<void> {
    this.isLoading = true;
    this.emptyState = 'none';
    this.sortedMeals = [];

    try {
      const currentMember =
        this.memberStateService.getCurrentMember();

      if (!currentMember) {
        this.isLoading = false;
        this.cdr.detectChanges();
        return;
      }

      const [allMeals, pantryItems, alwaysPresentItems] =
        await Promise.all([
          this.mealsService.getAllMeals(),
          this.pantryService.getPantryItems(),
          this.pantryService.getAlwaysPresentItems(spaceId),
        ]);

      const availableItems = [...pantryItems, ...alwaysPresentItems];

      const hasMeals = allMeals.length > 0;
      const hasPantry = availableItems.length > 0;

      if (!hasMeals && !hasPantry) {
        this.emptyState = 'both-empty';
      } else if (!hasMeals) {
        this.emptyState = 'no-meals';
      } else if (!hasPantry) {
        this.emptyState = 'empty-pantry';
      } else {
        this.sortedMeals = this.buildSortedMeals(
          allMeals,
          availableItems
        );
      }
    } catch (error) {
      console.error(
        'Error loading cook from pantry suggestions:',
        error
      );
      this.emptyState = 'both-empty';
      this.sortedMeals = [];
    } finally {
      this.isLoading = false;
      this.cdr.detectChanges();
    }
  }

  private buildSortedMeals(
  meals: Meal[],
  availableItems: (PantryItem | AlwaysPresentPantryItem)[]
): CookFromPantryMeal[] {
    const pantrySet = new Set(
      availableItems
        .map((item) =>
          item.normalized_name?.trim().toLowerCase()
        )
        .filter(Boolean)
    );

    return meals
      .map((meal) => {
        const normalizedIngredients = (meal.ingredients ?? [])
          .map((ingredient) =>
            ingredient.trim().toLowerCase()
          )
          .filter(Boolean);

        const totalCount = normalizedIngredients.length;

        if (totalCount === 0) {
          return null;
        }
        const matchedCount = normalizedIngredients.filter(
          (ingredient) => pantrySet.has(ingredient)
        ).length;

        if (matchedCount === 0) {
          return null;
        }

        return {
          ...meal,
          score: matchedCount / totalCount,
          matchedCount,
          totalCount,
        };
      })
      .filter((meal): meal is CookFromPantryMeal => meal !== null)
      .sort((a, b) => b.score - a.score);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}