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
import { filter, map, distinctUntilChanged, takeUntil, skip } from 'rxjs/operators';
import { GenerateSheetListComponent } from './generate-list-sheet/generate-sheet-list.component';
import { GroceryService } from '../../services/grocery.service';
import { MemberStateService } from '../../services/member.state.service';
import { SnackbarComponent } from '../../shared/components/snackbar/snackbar.component';
import {
  detectPossibleMergeCandidatesFromRawIngredients,
  buildIngredientsFromRawIngredients,
  applySelectedMergesToRawIngredients
} from '../../shared/utils/ingredient-merge.util';
import {
  MergeReviewSheetComponent,
  MergeCandidate,
  MergeApplyValue,
} from '../../shared/components/merge-review-sheet/merge-review-sheet.component';
import { normalizeIngredientKey } from '../../shared/utils/ingredient.util';
import { parseMeasurementStyleIngredient } from '../../shared/utils/measurement-style.util';
import {
  IngredientRulesService,
  MeasurementRuleRow
} from '../../services/ingredient-rules.service';
import { Clock3, UserRound } from 'lucide-angular';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';
import { LanguageStateService } from '../../services/language.state.service';



@Component({
  selector: 'app-plan',
  standalone: true,
  imports: [CommonModule, RouterModule, PageLoadingComponent, CalendarPickerComponent, LucideAngularModule, GenerateSheetListComponent, SnackbarComponent, MergeReviewSheetComponent, TranslatePipe],
  templateUrl: './plan.component.html',
  styleUrl: './plan.component.scss',
})
export class PlanComponent implements OnInit, OnDestroy {
  weekMeals: DayPlan[] = [];
  isLoading = true;
  currentWeekStart: Date = this.getStartOfWeek(new Date());
  selectedDayIndex: number | null = null;

  isCalendarOpen = false;
  selectedCalendarDates: string[] = [];
  isGenerateSheetOpen = false;

  generateSheetDays: any[] = [];

  snackbarMessage: string | null = null;
  snackbarActionLabel: string | null = null;
  isSnackbarVisible = false;
  isGeneratingList = false;

  private lastGeneratedListId: string | null = null;
  private snackbarTimeout: any;

  readonly chevronLeftIcon = ChevronLeft;
  readonly chevronRightIcon = ChevronRight;
  readonly calendarIcon = CalendarDays;
  readonly groceryListsIcon = ShoppingCart;
  readonly clock3Icon = Clock3;
  readonly userRoundIcon = UserRound;

  coveredMealIds = new Set<string>();
  coveredMealToListName = new Map<string, string>();

  isMergeSheetOpen = false;
  mergeSheetData: {
    rawIngredients: string[];
    selection: {
      selectedDayKeys: string[];
      selectedMealIds: string[];
    };
    candidates: MergeCandidate[];
  } | null = null;

  private destroy$ = new Subject<void>();


  @ViewChildren('mealCard') mealCards!: QueryList<ElementRef<HTMLElement>>;
  @ViewChildren('dayBtn') dayButtons!: QueryList<ElementRef<HTMLElement>>;

  constructor(
    private mealPlanService: MealPlanService,
    private ingredientRulesService: IngredientRulesService,
    private spaceStateService: SpaceStateService,
    private cdr: ChangeDetectorRef,
    private router: Router,
    private groceryService: GroceryService,
    private memberStateService: MemberStateService,
    private languageStateService: LanguageStateService
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

  this.languageStateService.currentLanguage$
    .pipe(
      skip(1),
      takeUntil(this.destroy$)
    )
    .subscribe(async () => {
      await this.loadWeekPlan();

      if (this.isGenerateSheetOpen) {
        this.buildGenerateSheetDays();
      }

      this.cdr.detectChanges();
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
      await this.loadCoveredMealsMap();
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

  private async loadCoveredMealsMap(): Promise<void> {
    const coverage = await this.groceryService.getCoveredMealsMap();
    this.coveredMealIds = coverage.coveredMealIds;
    this.coveredMealToListName = coverage.coveredMealToListName;
  }

  isMealCovered(mealId: string | number): boolean {
    return this.coveredMealIds.has(String(mealId));
  }

  getMealCoverageListName(mealId: string | number): string | null {
    return this.coveredMealToListName.get(String(mealId)) ?? null;
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
    return this.languageStateService.t(`mealStatus.${status}`);
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

    const isBg = this.languageStateService.getLanguage() === 'bg';

    const monthNames = isBg
      ? ['Ян', 'Фев', 'Март', 'Апр', 'Май', 'Юни', 'Юли', 'Авг', 'Сеп', 'Окт', 'Ное', 'Дек']
      : ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    const startMonth = monthNames[start.getMonth()];
    const endMonth = monthNames[end.getMonth()];

    if (isBg) {
      if (startMonth === endMonth) {
        return `${start.getDate()} – ${end.getDate()} ${startMonth}`;
      }
      return `${start.getDate()} ${startMonth} – ${end.getDate()} ${endMonth}`;
    }

    if (startMonth === endMonth) {
      return `${startMonth} ${start.getDate()} – ${end.getDate()}`;
    }

    return `${startMonth} ${start.getDate()} – ${endMonth} ${end.getDate()}`;
  }

  get hasMealsInSelectedWeek(): boolean {
    return this.weekMeals.some(day => day.meals.length > 0);
  }

  generateWeeklyList(): void {
    if (this.isGeneratingList) {
      return;
    }
    this.isGenerateSheetOpen = true;
  }

  closeGenerateSheet(): void {
    this.isGenerateSheetOpen = false;
  }

  async onQuickGenerateList(): Promise<void> {
    if (this.isGeneratingList) {
      return;
    }

    const eligibleDays = this.generateSheetDays
      .map((day) => ({
        ...day,
        meals: day.meals.filter((meal: any) => !meal.isCovered),
      }))
      .filter((day) => day.meals.length > 0);

    const selectedDayKeys = eligibleDays.map((day) => day.key);
    const selectedMealIds = eligibleDays.flatMap((day) =>
      day.meals.map((meal: any) => meal.id)
    );

    if (!selectedMealIds.length) {
      return;
    }

    const rawIngredients = this.getRawIngredientsFromSelectedMealIds(selectedMealIds);
    const mergeCandidates = detectPossibleMergeCandidatesFromRawIngredients(rawIngredients);
    const unresolvedCandidates = await this.filterRememberedMergeCandidates(mergeCandidates);

    if (unresolvedCandidates.length > 0) {
      await this.openMergeSheet({
        rawIngredients,
        selection: {
          selectedDayKeys,
          selectedMealIds,
        },
        candidates: unresolvedCandidates,
      });
      return;
    }

    const mergedRawIngredients =
      await this.applyRememberedWordRulesToRawIngredients(rawIngredients);

    const measurementPreparedIngredients =
      await this.applyMeasurementGroupingToRawIngredients(mergedRawIngredients);

    const finalIngredients =
      buildIngredientsFromRawIngredients(measurementPreparedIngredients);

    this.isGenerateSheetOpen = false;
    await this.createGeneratedListFromPreparedIngredients(
      selectedDayKeys,
      selectedMealIds,
      finalIngredients
    );
  }

  async onGenerateSelectedList(selection: {
    selectedDayKeys: string[];
    selectedMealIds: string[];
  }): Promise<void> {
    if (this.isGeneratingList) return;
    const rawIngredients = this.getRawIngredientsFromSelectedMealIds(
      selection.selectedMealIds
    );
    const mergeCandidates = detectPossibleMergeCandidatesFromRawIngredients(rawIngredients);
    const unresolvedCandidates = await this.filterRememberedMergeCandidates(mergeCandidates);

    if (unresolvedCandidates.length > 0) {
      await this.openMergeSheet({
        rawIngredients,
        selection,
        candidates: unresolvedCandidates,
      });
      return;
    }

    const mergedRawIngredients =
      await this.applyRememberedWordRulesToRawIngredients(rawIngredients);

    const measurementPreparedIngredients =
      await this.applyMeasurementGroupingToRawIngredients(mergedRawIngredients);

    const finalIngredients =
      buildIngredientsFromRawIngredients(measurementPreparedIngredients);

    this.isGenerateSheetOpen = false;
    await this.createGeneratedListFromPreparedIngredients(
      selection.selectedDayKeys,
      selection.selectedMealIds,
      finalIngredients
    );
  }

  private async openMergeSheet(data: {
    rawIngredients: string[];
    selection: {
      selectedDayKeys: string[];
      selectedMealIds: string[];
    };
    candidates: MergeCandidate[];
  }): Promise<void> {
    this.isGenerateSheetOpen = false;
    this.cdr.detectChanges();

    await new Promise((resolve) => setTimeout(resolve, 0));

    this.mergeSheetData = data;
    this.isMergeSheetOpen = true;
    this.cdr.detectChanges();
  }

  onMergeCancel(): void {
    this.isMergeSheetOpen = false;
    this.mergeSheetData = null;
  }

  async onMergeSkip(): Promise<void> {
    if (!this.mergeSheetData) {
      return;
    }

    const { rawIngredients, selection } = this.mergeSheetData;

    const mergedRawIngredients =
      await this.applyRememberedWordRulesToRawIngredients(rawIngredients);

    const measurementPreparedIngredients =
      await this.applyMeasurementGroupingToRawIngredients(mergedRawIngredients);

    const finalIngredients =
      buildIngredientsFromRawIngredients(measurementPreparedIngredients);

    this.isMergeSheetOpen = false;
    this.mergeSheetData = null;
    this.isGenerateSheetOpen = false;

    await this.createGeneratedListFromPreparedIngredients(
      selection.selectedDayKeys,
      selection.selectedMealIds,
      finalIngredients
    );
  }

  async onMergeApply(value: MergeApplyValue): Promise<void> {
    if (!this.mergeSheetData) {
      return;
    }

    const { selectedCandidates, remember } = value;
    const { rawIngredients, selection } = this.mergeSheetData;

    if (remember && selectedCandidates.length) {
      const currentSpace = this.spaceStateService.getCurrentSpace?.();

      if (currentSpace?.id) {
        await this.ingredientRulesService.saveWordRules(
          selectedCandidates.map((candidate) => ({
            spaceId: currentSpace.id,
            singularText: candidate.singularText,
            pluralText: candidate.pluralText,
          }))
        );
      }
    }

    const mergedRawIngredients = applySelectedMergesToRawIngredients(
      rawIngredients,
      selectedCandidates
    );

    const measurementPreparedIngredients =
      await this.applyMeasurementGroupingToRawIngredients(mergedRawIngredients);

    const finalIngredients =
      buildIngredientsFromRawIngredients(measurementPreparedIngredients);

    this.isMergeSheetOpen = false;
    this.mergeSheetData = null;
    this.isGenerateSheetOpen = false;

    await this.createGeneratedListFromPreparedIngredients(
      selection.selectedDayKeys,
      selection.selectedMealIds,
      finalIngredients
    );
  }

  private async saveIngredientWordRules(candidates: MergeCandidate[]): Promise<void> {
    const space = this.spaceStateService.getCurrentSpace?.();
    const spaceId = space?.id;

    if (!spaceId) {
      return;
    }

    const payload = candidates.map((candidate) => ({
      space_id: spaceId,
      singular_text: candidate.singularText,
      plural_text: candidate.pluralText,
    }));

    const { error } = await this.groceryService.supabase
      .from('ingredient_word_rules')
      .upsert(payload, {
        onConflict: 'space_id,singular_text,plural_text',
      });

    if (error) {
      console.error('Failed to save ingredient word rules:', error);
    }
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
    this.selectedCalendarDates = [this.formatDateForInput(new Date())];
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
          meals: day.meals.map((meal) => {
            const plannedMealId = String(meal.id);
            const isCovered = this.isMealCovered(plannedMealId);

            return {
              id: plannedMealId,
              name: meal.meal?.name || this.languageStateService.t('meals.untitledMeal'),
              isCovered,
              coveredListName: isCovered
                ? this.getMealCoverageListName(plannedMealId)
                : null,
            };
          }),
        };
      })
      .filter((day) => !day.isPast && day.meals.length > 0);
  }

  private getRawIngredientsFromSelectedMealIds(selectedMealIds: string[]): string[] {
    const rawIngredients: string[] = [];

    for (const day of this.weekMeals) {
      for (const plannedMeal of day.meals) {
        const plannedMealId = String(plannedMeal.id);

        if (!selectedMealIds.includes(plannedMealId)) {
          continue;
        }

        const mealIngredients = Array.isArray(plannedMeal.meal?.ingredients)
          ? plannedMeal.meal.ingredients
          : [];

        for (const ingredient of mealIngredients) {
          const cleaned =
            typeof ingredient === 'string' ? ingredient.trim() : '';

          if (cleaned) {
            rawIngredients.push(cleaned);
          }
        }
      }
    }

    return rawIngredients;
  }

  private getIngredientsFromSelectedMealIds(selectedMealIds: string[]): string[] {
    const rawIngredients = this.getRawIngredientsFromSelectedMealIds(selectedMealIds);
    return buildIngredientsFromRawIngredients(rawIngredients);
  }


  private buildGeneratedListMetadata(
    selectedDayKeys: string[],
    selectedMealIds: string[]
  ): Record<string, any> {
    const daysMap = new Map<
      string,
      {
        key: string;
        label: string;
        date: string;
        meals: Array<{ id: string; name: string }>;
      }
    >();

    for (const day of this.generateSheetDays) {
      if (!selectedDayKeys.includes(day.key)) {
        continue;
      }

      const selectedMealsForDay = day.meals
        .filter((meal: any) => selectedMealIds.includes(String(meal.id)))
        .map((meal: any) => ({
          id: String(meal.id),
          name: meal.name,
        }));

      if (!selectedMealsForDay.length) {
        continue;
      }

      daysMap.set(day.key, {
        key: day.key,
        label: day.label,
        date: day.date,
        meals: selectedMealsForDay,
      });
    }

    return {
      source: 'plan',
      generated: true,
      dayKeys: selectedDayKeys,
      mealIds: selectedMealIds,
      days: Array.from(daysMap.values()),
    };
  }


  private buildGeneratedListName(selectedDayKeys: string[]): string {
    const prefix = this.languageStateService.t('generateSheet.planListName');

    if (!selectedDayKeys.length) {
      return prefix;
    }

    const sortedKeys = [...selectedDayKeys].sort();

    const first = new Date(`${sortedKeys[0]}T12:00:00`);
    const last = new Date(`${sortedKeys[sortedKeys.length - 1]}T12:00:00`);

    const months = this.languageStateService.t('monthsLong') as unknown as string[];

    const formatDay = (date: Date): string => {
      const isBg = this.languageStateService.getLanguage() === 'bg';
      const day = date.getDate();
      const month = months[date.getMonth()];

      return isBg ? `${day} ${month}` : `${month} ${day}`;
    };

    const datePart =
      sortedKeys.length === 1
        ? formatDay(first)
        : `${formatDay(first)} – ${formatDay(last)}`;

    return `${prefix} ${datePart}`;
  }

  private async ensureUniqueGeneratedListName(baseName: string): Promise<string> {
    const existingLists = await this.groceryService.getGroceryLists();

    const matchingNames = existingLists
      .map((list) => list.name?.trim())
      .filter((name): name is string => !!name)
      .filter((name) => name === baseName || name.startsWith(`${baseName} (`));

    if (!matchingNames.includes(baseName)) {
      return baseName;
    }

    let suffix = 2;

    while (matchingNames.includes(`${baseName} (${suffix})`)) {
      suffix++;
    }

    return `${baseName} (${suffix})`;
  }

  private async createGeneratedListFromPreparedIngredients(
    selectedDayKeys: string[],
    selectedMealIds: string[],
    ingredients: string[]
  ): Promise<void> {
    const currentMember = this.memberStateService.getCurrentMember();
    if (!currentMember) {
      console.error('No current member selected');
      return;
    }

    const metadata = this.buildGeneratedListMetadata(
      selectedDayKeys,
      selectedMealIds
    );

    if (!ingredients.length) {
      console.warn('No ingredients found for selected meals');
      return;
    }

    this.isGeneratingList = true;
    this.showSnackbar(this.languageStateService.t('generateSheet.creatingList'));

    try {
      const baseName = this.buildGeneratedListName(selectedDayKeys);
      const listName = await this.ensureUniqueGeneratedListName(baseName);

      const createdList = await this.groceryService.createGroceryList(
        listName,
        currentMember.id,
        true,
        metadata
      );

      if (!createdList) {
        console.error('Failed to create generated grocery list');
        this.isGeneratingList = false;
        this.showSnackbar(this.languageStateService.t('generateSheet.createListFailed'));
        return;
      }

      for (const ingredient of ingredients) {
        await this.groceryService.createGroceryItem(
          createdList.id,
          ingredient,
          currentMember.id
        );
      }

      await this.loadCoveredMealsMap();
      this.buildGenerateSheetDays();

      this.lastGeneratedListId = createdList.id;
      this.isGeneratingList = false;
      this.showSnackbar(
        this.languageStateService.t('generateSheet.listCreated'),
        this.languageStateService.t('common.undo')
      );
    } catch (error) {
      console.error('Error creating generated grocery list:', error);
      this.isGeneratingList = false;
      this.showSnackbar(this.languageStateService.t('generateSheet.createListFailed'));
    }
  }

  private async createGeneratedListFromSelection(
    selectedDayKeys: string[],
    selectedMealIds: string[]
  ): Promise<void> {
    const ingredients = this.getIngredientsFromSelectedMealIds(selectedMealIds);

    await this.createGeneratedListFromPreparedIngredients(
      selectedDayKeys,
      selectedMealIds,
      ingredients
    );
  }

  private showSnackbar(message: string, actionLabel?: string): void {
    this.snackbarMessage = message;
    this.snackbarActionLabel = actionLabel || null;
    this.isSnackbarVisible = true;
    this.cdr.detectChanges();
    if (this.snackbarTimeout) {
      clearTimeout(this.snackbarTimeout);
    }
    this.snackbarTimeout = setTimeout(() => {
      this.hideSnackbar();
    }, 4000);
  }

  private hideSnackbar(): void {
    this.isSnackbarVisible = false;
    this.snackbarMessage = null;
    this.snackbarActionLabel = null;
    this.cdr.detectChanges();
  }

  async onSnackbarAction(): Promise<void> {
    if (!this.lastGeneratedListId) {
      return;
    }
    await this.groceryService.deleteGroceryList(this.lastGeneratedListId);
    this.lastGeneratedListId = null;
    await this.loadCoveredMealsMap();
    this.buildGenerateSheetDays();
    this.hideSnackbar();
  }

  private async saveRememberedWordRules(
    candidates: MergeCandidate[]
  ): Promise<void> {
    const space = this.spaceStateService.getCurrentSpace?.();

    if (!space?.id || !candidates.length) {
      return;
    }

    await this.ingredientRulesService.saveWordRules(
      candidates.map((c) => ({
        spaceId: space.id,
        singularText: c.singularText,
        pluralText: c.pluralText,
      }))
    );
  }

  private async filterRememberedMergeCandidates(
    candidates: MergeCandidate[]
  ): Promise<MergeCandidate[]> {
    const currentSpace = this.spaceStateService.getCurrentSpace?.();

    if (!currentSpace?.id || !candidates.length) {
      return candidates;
    }

    const rememberedRules = await this.ingredientRulesService.getWordRules(currentSpace.id);

    if (!rememberedRules.length) {
      return candidates;
    }

    return candidates.filter((candidate) => {
      const singular = normalizeIngredientKey(candidate.singularText);
      const plural = normalizeIngredientKey(candidate.pluralText);

      return !rememberedRules.some((rule) => {
        return (
          normalizeIngredientKey(rule.singular_text) === singular &&
          normalizeIngredientKey(rule.plural_text) === plural
        );
      });
    });
  }

  private async applyRememberedWordRulesToRawIngredients(
    rawIngredients: string[]
  ): Promise<string[]> {
    const currentSpace = this.spaceStateService.getCurrentSpace?.();

    if (!currentSpace?.id || !rawIngredients.length) {
      return rawIngredients;
    }

    const rememberedRules = await this.ingredientRulesService.getWordRules(currentSpace.id);

    if (!rememberedRules.length) {
      return rawIngredients;
    }

    const rememberedCandidates: MergeCandidate[] = rememberedRules.map((rule) => ({
      singularItems: [normalizeIngredientKey(rule.singular_text)],
      pluralItem: normalizeIngredientKey(rule.plural_text),
      singularText: normalizeIngredientKey(rule.singular_text),
      pluralText: normalizeIngredientKey(rule.plural_text),
      similarity: 1,
    }));

    return applySelectedMergesToRawIngredients(rawIngredients, rememberedCandidates);
  }

  private formatSummedMeasurementIngredient(
    count: number,
    style: 'cup' | 'tbsp' | 'tsp',
    ingredient: string
  ): string {
    let styleLabel: string = style;

    if (style === 'cup') {
      styleLabel = count === 1 ? 'cup' : 'cups';
    }

    return `${count} ${styleLabel} ${ingredient}`.trim();
  }

  private convertGroupedMeasurementIngredient(
    group: {
      ingredientKey: string;
      ingredientDisplay: string;
      style: 'cup' | 'tbsp' | 'tsp';
      count: number;
    },
    rememberedMeasurementRules: MeasurementRuleRow[]
  ): string {
    const rememberedRule = rememberedMeasurementRules.find((rule) => {
      return (
        normalizeIngredientKey(rule.ingredient_name) ===
        normalizeIngredientKey(group.ingredientDisplay) &&
        rule.measurement_style === group.style
      );
    });

    if (!rememberedRule) {
      return this.formatSummedMeasurementIngredient(
        group.count,
        group.style,
        group.ingredientDisplay
      );
    }

    const convertedBaseAmount =
      Number(rememberedRule.converted_amount) * group.count;

    if (!Number.isFinite(convertedBaseAmount)) {
      return this.formatSummedMeasurementIngredient(
        group.count,
        group.style,
        group.ingredientDisplay
      );
    }

    return `${convertedBaseAmount} ${rememberedRule.converted_unit} ${group.ingredientDisplay}`.trim();
  }

  private async applyMeasurementGroupingToRawIngredients(
    rawIngredients: string[]
  ): Promise<string[]> {
    if (!rawIngredients.length) {
      return rawIngredients;
    }

    const currentSpace = this.spaceStateService.getCurrentSpace?.();
    const rememberedMeasurementRules = currentSpace?.id
      ? await this.ingredientRulesService.getMeasurementRules(currentSpace.id)
      : [];

    const normalRawIngredients: string[] = [];
    const grouped = new Map<
      string,
      {
        ingredientKey: string;
        ingredientDisplay: string;
        style: 'cup' | 'tbsp' | 'tsp';
        count: number;
      }
    >();

    for (const raw of rawIngredients) {
      const parsed = parseMeasurementStyleIngredient(raw);

      if (!parsed) {
        normalRawIngredients.push(raw);
        continue;
      }

      const ingredientKey = normalizeIngredientKey(parsed.ingredient);
      const ingredientDisplay = parsed.ingredient.trim();
      const style = parsed.style;
      const key = `${style}__${ingredientKey}`;

      const existing = grouped.get(key);

      if (existing) {
        existing.count += parsed.count;
      } else {
        grouped.set(key, {
          ingredientKey,
          ingredientDisplay,
          style,
          count: parsed.count,
        });
      }
    }

    const groupedMeasurementItems = Array.from(grouped.values()).map((group) =>
      this.convertGroupedMeasurementIngredient(group, rememberedMeasurementRules)
    );

    return [...normalRawIngredients, ...groupedMeasurementItems];
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

}