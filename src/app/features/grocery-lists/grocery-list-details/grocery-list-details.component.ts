import { CommonModule } from '@angular/common';
import {
  ChangeDetectorRef,
  Component,
  HostListener,
  OnDestroy,
  OnInit,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { RealtimeChannel } from '@supabase/supabase-js';
import { PageLoadingComponent } from '../../../shared/components/page-loading/page-loading.component';
import { GroceryService } from '../../../services/grocery.service';
import { GroceryList } from '../../../models/grocery-list.model';
import { MemberStateService } from '../../../services/member.state.service';
import {
  ResponsiveActionMenuComponent,
  ResponsiveActionMenuItem,
} from '../../../shared/components/responsive-action-menu/responsive-action-menu';
import { Subject } from 'rxjs';
import { distinctUntilChanged, takeUntil } from 'rxjs/operators';
import { SpaceStateService } from '../../../services/space.state.service';
import { EditTextDialogComponent } from '../../../shared/components/edit-text-dialog/edit-text-dialog.component';
import { ConfirmationDialogComponent } from '../../../shared/components/confirmation-dialog/confirmation-dialog.component';
import { SnackbarComponent } from '../../../shared/components/snackbar/snackbar.component';
import { PantryActionDialogComponent } from '../../../shared/components/pantry-action-dialog/pantry-action-dialog.component';
import { PantryService } from '../../../services/pantry.service';
import {
  normalizeIngredientKey,
  parseLeadingNumberIngredient,
  parseCountedPlainIngredient,
} from '../../../shared/utils/ingredient.util';
import { AlwaysPresentPantryItem } from '../../../models/always-present-pantry-item.model';
import { isIngredientMatch } from '../../../shared/utils/ingredient-match.util';
import {
  convertToBaseUnit,
  formatAmountForDisplay,
} from '../../../shared/utils/unit.util';
import {
  MergeReviewSheetComponent,
  MergeCandidate,
  MergeApplyValue,
} from '../../../shared/components/merge-review-sheet/merge-review-sheet.component';
import {
  detectPossibleMergeCandidatesFromRawIngredients,
  getMergeableRawIngredientInfo,
  getIngredientSortKey,
} from '../../../shared/utils/ingredient-merge.util';
import { parseMeasurementStyleIngredient } from '../../../shared/utils/measurement-style.util';
import { ArrowLeftRight, LucideAngularModule } from 'lucide-angular';
import { MeasurementConversionSheetComponent } from './measurement-conversion-sheet/measurement-conversion-sheet.component';
import { IngredientRulesService } from '../../../services/ingredient-rules.service';


@Component({
  selector: 'app-grocery-list-details',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    PageLoadingComponent,
    ResponsiveActionMenuComponent,
    EditTextDialogComponent,
    ConfirmationDialogComponent,
    SnackbarComponent,
    PantryActionDialogComponent,
    MergeReviewSheetComponent,
    LucideAngularModule,
    MeasurementConversionSheetComponent
  ],
  templateUrl: './grocery-list-details.component.html',
  styleUrls: ['./grocery-list-details.component.scss'],
})
export class GroceryListDetailsComponent implements OnInit, OnDestroy {

  readonly measurementHintIcon = ArrowLeftRight;

  isLoading = true;
  groceryList: GroceryList | null = null;
  groceryItems: any[] = [];
  error = '';
  newItemName = '';
  alwaysPresentItems: AlwaysPresentPantryItem[] = [];

  openItemMenuId: string | null = null;

  selectedItemForActions: any | null = null;
  selectedItemForEdit: any | null = null;
  selectedItemForDelete: any | null = null;

  editItemName = '';

  itemActions: ResponsiveActionMenuItem[] = [
    { id: 'edit', label: 'Edit' },
    { id: 'delete', label: 'Delete' },
  ];

  isPantryDialogOpen = false;
  pantryDialogTitle = '';
  pantryDialogMessage = '';
  pantryDialogShowSkip = false;

  pendingPantryList: GroceryList | null = null;

  toastMessage = '';
  toastActionLabel: string | null = null;
  toastActionType: 'undo-complete' | null = null;
  undoCompletedList: GroceryList | null = null;

  hideAlwaysPresent = false;
  isCoverageExpanded = false;

  isMergeSheetOpen = false;
  mergeSheetData: {
    rawIngredients: string[];
    newItem: string;
    candidates: MergeCandidate[];
  } | null = null;

  pendingEditItemId: string | null = null;
  pendingEditItemName = '';

  private toastTimeout: ReturnType<typeof setTimeout> | null = null;
  private pendingRevealItemId: string | null = null;
  private itemsRefreshTimeout: ReturnType<typeof setTimeout> | null = null;

  isMeasurementSheetOpen = false;
  selectedMeasurementItem: any | null = null;

  selectedMeasurementItemMatchLabel: string | null = null;
  rememberedWordRules: Array<{
    singular_text: string;
    plural_text: string;
  }> = [];

  private destroy$ = new Subject<void>();
  private itemsChannel: RealtimeChannel | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private groceryService: GroceryService,
    private memberStateService: MemberStateService,
    private spaceStateService: SpaceStateService,
    private pantryService: PantryService,
    private ingredientRulesService: IngredientRulesService,
    private cdr: ChangeDetectorRef
  ) { }

  @HostListener('document:click')
  onDocumentClick(): void {
    this.openItemMenuId = null;
  }

  async ngOnInit(): Promise<void> {
    const listId = this.route.snapshot.paramMap.get('id');

    if (!listId) {
      this.error = 'Missing grocery list id.';
      this.isLoading = false;
      this.cdr.detectChanges();
      return;
    }

    this.spaceStateService.currentSpace$
      .pipe(
        takeUntil(this.destroy$),
        distinctUntilChanged((prev, curr) => prev?.id === curr?.id)
      )
      .subscribe((space) => {
        if (!space) {
          this.router.navigate(['/grocery-lists']);
          return;
        }

        if (this.groceryList && this.groceryList.space_id !== space.id) {
          this.router.navigate(['/grocery-lists']);
        }
      });

    await this.loadGroceryList(listId);
  }

  get isGeneratedList(): boolean {
    return !!this.groceryList?.generated;
  }

  async loadGroceryList(listId: string): Promise<void> {
    this.isLoading = true;
    this.error = '';

    try {
      this.groceryList = await this.groceryService.getGroceryListById(listId);

      if (!this.groceryList) {
        this.error = 'Grocery list not found.';
        return;
      }

      const items = await this.groceryService.getItemsByListId(listId);
      this.setGroceryItems(items);
      const spaceId = this.groceryList.space_id;
      this.alwaysPresentItems = await this.pantryService.getAlwaysPresentItems(spaceId);
      this.rememberedWordRules = await this.ingredientRulesService.getWordRules(spaceId);
      this.subscribeToGroceryItems(listId);
    } catch (error) {
      console.error('Error loading grocery list:', error);
      this.error = 'Could not load grocery list.';
    } finally {
      this.isLoading = false;
      this.cdr.detectChanges();
    }
  }

  private regroupGeneratedItems(items: any[]): any[] {
    const groups = new Map<string, any[]>();
    const order: string[] = [];

    for (const item of items) {
      const key = getIngredientSortKey(item.name);

      if (!groups.has(key)) {
        groups.set(key, []);
        order.push(key);
      }

      groups.get(key)!.push(item);
    }

    return order.flatMap((key) => groups.get(key)!);
  }

  isAlwaysPresentHint(itemName: string): boolean {
    return this.alwaysPresentItems.some((alwaysPresentItem) =>
      isIngredientMatch(itemName, alwaysPresentItem.name)
    );
  }

  subscribeToGroceryItems(listId: string): void {
    this.itemsChannel?.unsubscribe();

    this.itemsChannel = this.groceryService.supabase
      .channel(`grocery-list-items-${listId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'grocery_list_items',
          filter: `grocery_list_id=eq.${listId}`,
        },
        async () => {
          if (!this.groceryList) {
            return;
          }

          if (this.itemsRefreshTimeout) {
            clearTimeout(this.itemsRefreshTimeout);
          }

          this.itemsRefreshTimeout = setTimeout(async () => {
            const items = await this.groceryService.getItemsByListId(listId);
            this.setGroceryItems(items);
            this.cdr.detectChanges();

            if (this.pendingRevealItemId) {
              const itemId = this.pendingRevealItemId;

              setTimeout(() => {
                this.revealItem(itemId);
              }, 120);

              this.pendingRevealItemId = null;
            }
          }, 80);
        }
      )
      .subscribe();
  }

  get visibleGroceryItems(): any[] {
    if (!this.hideAlwaysPresent || !this.alwaysPresentItems.length) {
      return this.groceryItems;
    }

    return this.groceryItems.filter(
      (item) =>
        !this.alwaysPresentItems.some((ap) =>
          isIngredientMatch(item.name, ap.name)
        )
    );
  }

  async onEnterAddItem(): Promise<void> {
    const trimmed = this.newItemName.trim();
    if (!trimmed || this.isReadOnly) {
      return;
    }
    await this.addItem();
  }


  async addItem(): Promise<void> {
    if (this.isReadOnly) return;

    const trimmedName = this.newItemName.trim();
    if (!trimmedName || !this.groceryList) {
      return;
    }

    const handledByRememberedWordRule = await this.applyRememberedWordRuleForAdd(trimmedName);
    if (handledByRememberedWordRule) {
      return;
    }

    const rawIngredients = [
      ...this.groceryItems.map(i => i.name),
      trimmedName
    ];

    const candidates = detectPossibleMergeCandidatesFromRawIngredients(rawIngredients);
    const normalizedNewItem = normalizeIngredientKey(trimmedName).toLowerCase();

    const relevantCandidates = candidates.filter((c: MergeCandidate) =>
      c.singularItems.includes(normalizedNewItem) ||
      c.pluralItem === normalizedNewItem
    );

    const unresolvedCandidates = await this.filterRememberedCandidates(relevantCandidates);

    if (unresolvedCandidates.length > 0) {
      await this.openMergeSheet({
        rawIngredients,
        newItem: trimmedName,
        candidates: unresolvedCandidates,
      });
      return;
    }

    const currentMember = this.memberStateService.getCurrentMember();
    const addedByMemberId = currentMember?.id ?? 1;

    const measuredMatch = this.groceryItems.find((item) => {
      const parsed = parseLeadingNumberIngredient(
        normalizeIngredientKey(item.name)
      );

      return (
        parsed &&
        parsed.unit &&
        normalizeIngredientKey(parsed.name) ===
        normalizeIngredientKey(trimmedName)
      );
    });

    if (measuredMatch) {
      const mergedName = this.buildMergeResult(
        measuredMatch.name,
        trimmedName
      );

      if (mergedName) {
        const success = await this.groceryService.updateGroceryItemName(
          measuredMatch.id,
          mergedName
        );

        if (!success) {
          this.error = 'Could not update grocery item.';
          this.cdr.detectChanges();
          return;
        }

        this.newItemName = '';
        this.pendingRevealItemId = measuredMatch.id;
        return;
      }
    }

    for (const item of this.groceryItems) {
      const mergedName = this.buildMergeResult(item.name, trimmedName);
      if (!mergedName) continue;

      const success = await this.groceryService.updateGroceryItemName(
        item.id,
        mergedName
      );

      if (!success) {
        this.error = 'Could not update grocery item.';
        this.cdr.detectChanges();
        return;
      }

      this.newItemName = '';
      this.pendingRevealItemId = item.id;
      return;
    }

    const created = await this.groceryService.createGroceryItem(
      this.groceryList.id,
      trimmedName,
      addedByMemberId
    );

    if (!created) {
      this.error = 'Could not add grocery item.';
      this.cdr.detectChanges();
      return;
    }

    this.newItemName = '';
    this.pendingRevealItemId = created.id;
  }

  private setGroceryItems(items: any[]): void {
    if (this.isGeneratedList) {
      this.groceryItems = this.regroupGeneratedItems(items);
    } else {
      this.groceryItems = items;
    }
  }

  private buildMergeResult(
    existingName: string,
    newName: string
  ): string | null {
    const normalizedExisting = normalizeIngredientKey(existingName);
    const normalizedNew = normalizeIngredientKey(newName);

    const parsedExisting = parseLeadingNumberIngredient(normalizedExisting);
    const parsedNew = parseLeadingNumberIngredient(normalizedNew);

    const countedExisting = parseCountedPlainIngredient(normalizedExisting);
    const countedNew = parseCountedPlainIngredient(normalizedNew);


    const multiMeasuredMatch = normalizedNew.match(/^(\d+)\s*[x×]\s*(.+)$/i);

    if (multiMeasuredMatch) {
      const count = Number(multiMeasuredMatch[1]);
      const rest = multiMeasuredMatch[2];

      const parsed = parseLeadingNumberIngredient(rest);

      if (parsed && parsed.unit) {
        const converted = convertToBaseUnit(parsed.amount, parsed.unit);

        if (converted) {
          const totalAmount = converted.amount * count;

          if (
            parsedExisting &&
            parsedExisting.unit &&
            parsedExisting.name.toLowerCase() === parsed.name.toLowerCase()
          ) {
            const existingConverted = convertToBaseUnit(
              parsedExisting.amount,
              parsedExisting.unit
            );

            if (
              existingConverted &&
              existingConverted.unit === converted.unit
            ) {
              const finalAmount = existingConverted.amount + totalAmount;

              const finalFormatted = formatAmountForDisplay(
                finalAmount,
                converted.unit
              );

              return `${finalFormatted.amount} ${finalFormatted.unit} ${parsed.name}`.trim();
            }
          }

          // fallback (only if no merge possible)
          const formatted = formatAmountForDisplay(totalAmount, converted.unit);

          return `${formatted.amount} ${formatted.unit} ${parsed.name}`.trim();
        }
      }
    }

    // measured + measured => sum using base units if same ingredient name
    if (parsedExisting && parsedNew && parsedExisting.unit && parsedNew.unit) {
      const convertedExisting = convertToBaseUnit(parsedExisting.amount, parsedExisting.unit);
      const convertedNew = convertToBaseUnit(parsedNew.amount, parsedNew.unit);

      if (
        convertedExisting &&
        convertedNew &&
        convertedExisting.unit === convertedNew.unit &&
        parsedExisting.name.toLowerCase() === parsedNew.name.toLowerCase()
      ) {
        const totalAmount = convertedExisting.amount + convertedNew.amount;
        const formatted = formatAmountForDisplay(totalAmount, convertedExisting.unit);

        return `${formatted.amount} ${formatted.unit} ${parsedExisting.name}`.trim();
      }
    }

    // numeric-leading + numeric-leading without convertible units
    if (
      parsedExisting &&
      parsedNew &&
      !parsedExisting.unit &&
      !parsedNew.unit &&
      parsedExisting.suffix.toLowerCase() === parsedNew.suffix.toLowerCase()
    ) {
      return `${parsedExisting.amount + parsedNew.amount} ${parsedExisting.suffix}`.trim();
    }

    // numeric-leading + counted plain
    if (
      parsedExisting &&
      countedNew &&
      parsedExisting.suffix.toLowerCase() === countedNew.text.toLowerCase()
    ) {
      return `${parsedExisting.amount + countedNew.count} ${parsedExisting.suffix}`.trim();
    }

    // counted plain + numeric-leading
    if (
      countedExisting &&
      parsedNew &&
      countedExisting.text.toLowerCase() === parsedNew.suffix.toLowerCase()
    ) {
      return `${countedExisting.count + parsedNew.amount} ${parsedNew.suffix}`.trim();
    }

    // plain text + same plain text
    if (
      !parsedExisting &&
      !parsedNew &&
      !countedExisting &&
      !countedNew &&
      normalizedExisting === normalizedNew
    ) {
      return `2 × ${normalizedExisting}`;
    }

    // counted plain + same plain text
    if (
      countedExisting &&
      !parsedNew &&
      !countedNew &&
      countedExisting.text.toLowerCase() === normalizedNew.toLowerCase()
    ) {
      return `${countedExisting.count + 1} × ${countedExisting.text}`;
    }

    // plain text + counted plain
    if (
      !parsedExisting &&
      !countedExisting &&
      countedNew &&
      normalizedExisting.toLowerCase() === countedNew.text.toLowerCase()
    ) {
      return `${countedNew.count + 1} × ${normalizedExisting}`;
    }

    return null;
  }

  async onMergeCancel(): Promise<void> {
    this.isMergeSheetOpen = false;
    this.mergeSheetData = null;
    this.pendingEditItemId = null;
    this.pendingEditItemName = '';
    this.cdr.detectChanges();
  }

  async onMergeSkip(): Promise<void> {
    this.isMergeSheetOpen = false;

    if (this.pendingEditItemId && this.pendingEditItemName) {
      const success = await this.groceryService.updateGroceryItemName(
        this.pendingEditItemId,
        this.pendingEditItemName
      );

      if (!success) {
        this.error = 'Could not update grocery item.';
        this.cdr.detectChanges();
        return;
      }

      this.pendingRevealItemId = this.pendingEditItemId;
      this.pendingEditItemId = null;
      this.pendingEditItemName = '';
      this.mergeSheetData = null;
      return;
    }

    this.mergeSheetData = null;
    await this.addItemWithoutMerge();
  }

  async onMergeApply(value: MergeApplyValue): Promise<void> {
    if (!this.mergeSheetData || !this.groceryList) {
      return;
    }
    const { selectedCandidates, remember } = value;

    if (remember && selectedCandidates.length) {
      await this.saveRememberedWordRules(selectedCandidates);
    }

    this.isMergeSheetOpen = false;

    if (!selectedCandidates.length) {
      if (this.pendingEditItemId && this.pendingEditItemName) {
        const success = await this.groceryService.updateGroceryItemName(
          this.pendingEditItemId,
          this.pendingEditItemName
        );
        if (!success) {
          this.error = 'Could not update grocery item.';
          this.cdr.detectChanges();
          return;
        }
        this.pendingRevealItemId = this.pendingEditItemId;
        this.pendingEditItemId = null;
        this.pendingEditItemName = '';
        this.mergeSheetData = null;
        const items = await this.groceryService.getItemsByListId(this.groceryList.id);
        this.setGroceryItems(items);
        this.cdr.detectChanges();
        return;
      }

      this.mergeSheetData = null;
      await this.addItemWithoutMerge();
      return;
    }

    let revealTargetId: string | null = null;

    for (const candidate of selectedCandidates) {
      const targetId = await this.applySingleMergeCandidateToList(
        candidate,
        this.mergeSheetData.newItem
      );

      if (!revealTargetId && targetId) {
        revealTargetId = targetId;
      }
    }
    this.pendingEditItemId = null;
    this.pendingEditItemName = '';
    this.mergeSheetData = null;
    this.newItemName = '';
    const items = await this.groceryService.getItemsByListId(this.groceryList.id);
    this.setGroceryItems(items);
    this.cdr.detectChanges();
    if (revealTargetId) {
      this.pendingRevealItemId = revealTargetId;
    }
  }

  private async applySingleMergeCandidateToList(
    candidate: MergeCandidate,
    pendingNewItem: string
  ): Promise<string | null> {
    if (!this.groceryList) {
      return null;
    }

    const matchedItems = this.groceryItems.filter((item) => {
      if (this.pendingEditItemId && item.id === this.pendingEditItemId) {
        return false;
      }

      const info = getMergeableRawIngredientInfo(item.name);
      if (!info) {
        return false;
      }

      const matchesSingular =
        info.kind === 'singularish' &&
        info.text === candidate.singularText;

      const matchesPlural =
        info.kind === 'pluralish' &&
        info.text === candidate.pluralText;

      return matchesSingular || matchesPlural;
    });

    if (!matchedItems.length) {
      return null;
    }

    let totalCount = 0;
    for (const item of matchedItems) {
      const info = getMergeableRawIngredientInfo(item.name);
      if (info) {
        totalCount += info.count;
      }
    }
    const pendingInfo = getMergeableRawIngredientInfo(pendingNewItem);
    if (pendingInfo) {
      const matchesPendingSingular =
        pendingInfo.kind === 'singularish' &&
        pendingInfo.text === candidate.singularText;

      const matchesPendingPlural =
        pendingInfo.kind === 'pluralish' &&
        pendingInfo.text === candidate.pluralText;

      if (matchesPendingSingular || matchesPendingPlural) {
        totalCount += pendingInfo.count;
      }
    }
    if (totalCount === 0) {
      return null;
    }

    const finalName = `${totalCount} ${candidate.pluralText}`.trim();
    const targetItem = matchedItems[0];
    const updateSuccess = await this.groceryService.updateGroceryItemName(
      targetItem.id,
      finalName
    );

    if (!updateSuccess) {
      this.error = 'Could not update grocery item.';
      this.cdr.detectChanges();
      return null;
    }

    for (const item of matchedItems.slice(1)) {
      await this.groceryService.deleteGroceryItem(item.id);
    }

    if (this.pendingEditItemId) {
      await this.groceryService.deleteGroceryItem(this.pendingEditItemId);
    }

    return targetItem.id;
  }

  private async addItemWithoutMerge(): Promise<void> {
    const trimmedName = this.newItemName.trim();
    if (!trimmedName || !this.groceryList) return;

    const currentMember = this.memberStateService.getCurrentMember();
    const addedByMemberId = currentMember?.id ?? 1;

    const created = await this.groceryService.createGroceryItem(
      this.groceryList.id,
      trimmedName,
      addedByMemberId
    );

    if (!created) return;
    this.newItemName = '';
    this.insertNewItemLocally(created);
    this.cdr.detectChanges();
    this.revealItem(created.id);
  }

  async toggleItem(item: any): Promise<void> {
    if (this.isReadOnly || this.isEditDialogOpen || this.isDeleteDialogOpen) {
      return;
    }

    const nextStatus = item.status === 'bought' ? 'needed' : 'bought';
    const currentMember = this.memberStateService.getCurrentMember();
    const boughtByMemberId = currentMember?.id ?? 1;

    // optimistic UI update
    const previousStatus = item.status;
    const previousBoughtBy = item.boughtBy;

    item.status = nextStatus;

    if (nextStatus === 'bought') {
      item.boughtBy = {
        id: boughtByMemberId,
        name: currentMember?.name || 'You',
      };
    } else {
      item.boughtBy = null;
    }

    this.cdr.detectChanges();

    const updated = await this.groceryService.updateGroceryItemStatus(
      item.id,
      nextStatus,
      boughtByMemberId
    );

    if (!updated || !this.groceryList) {
      item.status = previousStatus;
      item.boughtBy = previousBoughtBy;
      this.cdr.detectChanges();
      return;
    }

    if (nextStatus === 'needed') {
      const resetSuccess = await this.groceryService.updateGroceryItemMovedToPantry(
        item.id,
        false
      );

      if (!resetSuccess) {
        item.status = previousStatus;
        item.boughtBy = previousBoughtBy;
        this.error = 'Could not reset pantry state.';
        this.cdr.detectChanges();
        return;
      }
    }

    const items = await this.groceryService.getItemsByListId(this.groceryList.id);
    this.setGroceryItems(items);
    this.cdr.detectChanges();
  }


  toggleItemMenu(event: Event, item: any): void {
    event.stopPropagation();

    if (this.isReadOnly) {
      return;
    }

    if (this.isMobileViewport()) {
      this.selectedItemForActions = item;
    } else {
      this.openItemMenuId = this.openItemMenuId === item.id ? null : item.id;
    }
  }

  openEditDialog(event: Event, item: any): void {
    if (this.isReadOnly) return;

    event.stopPropagation();
    this.openItemMenuId = null;
    this.selectedItemForActions = null;
    this.selectedItemForEdit = item;
    this.editItemName = item.name ?? '';
  }

  closeEditDialog(): void {
    this.selectedItemForEdit = null;
    this.editItemName = '';
  }

  async confirmEditItem(): Promise<void> {
    const trimmedName = this.editItemName.trim();
    const itemId = this.selectedItemForEdit?.id;

    if (!itemId || !trimmedName || !this.groceryList) {
      return;
    }

    const handledByRememberedWordRule = await this.applyRememberedWordRuleForEdit(
      itemId,
      trimmedName
    );

    if (handledByRememberedWordRule) {
      this.closeEditDialog();
      return;
    }

    const rawIngredients = [
      ...this.groceryItems
        .filter((item) => item.id !== itemId)
        .map((item) => item.name),
      trimmedName,
    ];

    const candidates = detectPossibleMergeCandidatesFromRawIngredients(rawIngredients);
    const normalizedEditedItem = normalizeIngredientKey(trimmedName).toLowerCase();

    const relevantCandidates = candidates.filter((c: MergeCandidate) =>
      c.singularItems.includes(normalizedEditedItem) ||
      c.pluralItem === normalizedEditedItem
    );

    const unresolvedCandidates = await this.filterRememberedCandidates(relevantCandidates);

    if (unresolvedCandidates.length > 0) {
      this.pendingEditItemId = itemId;
      this.pendingEditItemName = trimmedName;

      this.closeEditDialog();

      await this.openMergeSheet({
        rawIngredients,
        newItem: trimmedName,
        candidates: unresolvedCandidates,
      });
      return;
    }

    const measuredMatch = this.groceryItems.find((item) => {
      if (item.id === itemId) return false;

      const parsed = parseLeadingNumberIngredient(
        normalizeIngredientKey(item.name)
      );

      return (
        parsed &&
        parsed.unit &&
        normalizeIngredientKey(parsed.name) ===
        normalizeIngredientKey(trimmedName)
      );
    });

    if (measuredMatch) {
      const mergedName = this.buildMergeResult(
        measuredMatch.name,
        trimmedName
      );

      if (mergedName) {
        const success = await this.groceryService.updateGroceryItemName(
          measuredMatch.id,
          mergedName
        );

        if (!success) {
          this.error = 'Could not update grocery item.';
          this.cdr.detectChanges();
          return;
        }

        await this.groceryService.deleteGroceryItem(itemId);

        this.pendingRevealItemId = measuredMatch.id;
        this.closeEditDialog();
        return;
      }
    }

    for (const item of this.groceryItems) {
      if (item.id === itemId) continue;

      const mergedName = this.buildMergeResult(item.name, trimmedName);
      if (!mergedName) continue;

      const success = await this.groceryService.updateGroceryItemName(
        item.id,
        mergedName
      );

      if (!success) {
        this.error = 'Could not update grocery item.';
        this.cdr.detectChanges();
        return;
      }

      await this.groceryService.deleteGroceryItem(itemId);

      this.pendingRevealItemId = item.id;
      this.closeEditDialog();
      return;
    }

    const success = await this.groceryService.updateGroceryItemName(
      itemId,
      trimmedName
    );

    if (!success) {
      this.error = 'Could not update grocery item.';
      this.cdr.detectChanges();
      return;
    }

    this.pendingRevealItemId = itemId;
    this.closeEditDialog();
  }


  private hasRelatedGeneratedBlock(name: string, excludeItemId?: string): boolean {
    const targetKey = getIngredientSortKey(name);

    return this.groceryItems.some(
      (item) =>
        item.id !== excludeItemId &&
        getIngredientSortKey(item.name) === targetKey
    );
  }

  private insertNewItemLocally(createdItem: any): void {
    if (!this.isGeneratedList) {
      this.groceryItems = [...this.groceryItems, createdItem];
      return;
    }

    const hasBlock = this.hasRelatedGeneratedBlock(createdItem.name, createdItem.id);

    if (!hasBlock) {
      this.groceryItems = [...this.groceryItems, createdItem];
      return;
    }

    const items = [...this.groceryItems, createdItem];
    this.groceryItems = this.regroupGeneratedItems(items);
  }

  openDeleteDialog(event: Event, item: any): void {
    if (this.isReadOnly) return;

    event.stopPropagation();
    this.openItemMenuId = null;
    this.selectedItemForActions = null;
    this.selectedItemForDelete = item;
  }

  closeDeleteDialog(): void {
    this.selectedItemForDelete = null;
  }

  async confirmDeleteItem(): Promise<void> {
    const item = this.selectedItemForDelete;

    if (!item) {
      return;
    }

    const success = await this.groceryService.deleteGroceryItem(item.id);

    if (!success) {
      this.error = 'Could not delete grocery item.';
      this.cdr.detectChanges();
      return;
    }

    this.groceryItems = this.groceryItems.filter(
      (currentItem) => currentItem.id !== item.id
    );

    if (this.selectedItemForEdit?.id === item.id) {
      this.closeEditDialog();
    }

    this.closeDeleteDialog();
    this.cdr.detectChanges();
  }

  getDeleteMessage(): string {
    if (!this.selectedItemForDelete?.name) {
      return 'Are you sure you want to delete this item?';
    }

    return `Are you sure you want to delete "${this.selectedItemForDelete.name}"?`;
  }

  getItemMetaParts(item: any) {
    const currentMember = this.memberStateService.getCurrentMember();

    const isAddedByYou = currentMember?.id === item.addedBy?.id;
    const isBoughtByYou = currentMember?.id === item.boughtBy?.id;

    return {
      addedByName: item.addedBy?.name || 'Someone',
      boughtByName: item.boughtBy?.name || 'Someone',
      isAddedByYou,
      isBoughtByYou,
      isBought: item.status === 'bought',
    };
  }

  goBack(): void {
    window.history.back();
  }

  isMobileViewport(): boolean {
    return window.innerWidth < 1024;
  }

  async onItemActionSelected(actionId: string): Promise<void> {
    const item = this.selectedItemForActions;
    if (!item) return;

    this.selectedItemForActions = null;

    switch (actionId) {
      case 'edit':
        this.openEditDialog(new Event('click'), item);
        break;

      case 'delete':
        this.openDeleteDialog(new Event('click'), item);
        break;
    }
  }

  get isReadOnly(): boolean {
    return (
      this.groceryList?.status === 'completed' ||
      this.groceryList?.status === 'archived'
    );
  }

  get isEditDialogOpen(): boolean {
    return !!this.selectedItemForEdit;
  }

  get isDeleteDialogOpen(): boolean {
    return !!this.selectedItemForDelete;
  }

  async onCompleteList(): Promise<void> {
    if (!this.groceryList) {
      return;
    }
    const pending = await this.groceryService.getPendingPantryItemsCount(
      this.groceryList.id
    );
    if (pending > 0) {
      this.openPantryDialogForComplete(this.groceryList, pending);
      return;
    }
    const success = await this.groceryService.completeGroceryList(
      this.groceryList.id
    );
    if (!success) {
      this.error = 'Could not complete list.';
      this.cdr.detectChanges();
      return;
    }
    this.groceryList = {
      ...this.groceryList,
      status: 'completed',
      updated_at: new Date().toISOString(),
    };

    this.showCompletedUndoToast(this.groceryList);
    this.cdr.detectChanges();
  }

  openPantryDialogForComplete(list: GroceryList, pending: number): void {
    this.pendingPantryList = list;
    this.pantryDialogTitle = 'Move to pantry?';
    this.pantryDialogMessage = `This list has ${pending} bought ${pending === 1 ? 'item' : 'items'} that can be moved to pantry.`;
    this.pantryDialogShowSkip = true;
    this.isPantryDialogOpen = true;

    this.cdr.detectChanges();
  }

  showToast(message: string, actionLabel?: string): void {
    this.toastMessage = message;
    this.toastActionLabel = actionLabel ?? null;

    if (!actionLabel) {
      this.toastActionType = null;
      this.undoCompletedList = null;
    }

    if (this.toastTimeout) {
      clearTimeout(this.toastTimeout);
    }

    this.cdr.detectChanges();

    const duration = actionLabel ? 3500 : 2500;

    this.toastTimeout = setTimeout(() => {
      this.clearToastState();
      this.cdr.detectChanges();
    }, duration);
  }

  async undoCompleteList(): Promise<void> {
    const list = this.undoCompletedList;

    if (!list) {
      this.clearToastState();
      return;
    }

    const success = await this.groceryService.updateGroceryListStatus(
      list.id,
      'active'
    );

    if (!success) {
      this.error = 'Could not undo completed list.';
      this.clearToastState();
      this.cdr.detectChanges();
      return;
    }

    this.groceryList = {
      ...this.groceryList!,
      status: 'active',
      updated_at: new Date().toISOString(),
    };

    this.clearToastState();
    this.cdr.detectChanges();
  }

  async onToastAction(): Promise<void> {
    if (this.toastActionType === 'undo-complete') {
      await this.undoCompleteList();
      return;
    }

    this.clearToastState();
  }

  clearToastState(): void {
    this.toastMessage = '';
    this.toastActionLabel = null;
    this.toastActionType = null;
    this.undoCompletedList = null;

    if (this.toastTimeout) {
      clearTimeout(this.toastTimeout);
      this.toastTimeout = null;
    }
  }

  showCompletedUndoToast(list: GroceryList): void {
    this.undoCompletedList = list;
    this.toastActionType = 'undo-complete';
    this.showToast('List marked as completed', 'Undo');
  }

  async onPantryDialogAction(
    action: 'move' | 'skip' | 'archive' | 'cancel'
  ): Promise<void> {
    const list = this.pendingPantryList;

    if (!list) {
      this.closePantryDialog();
      return;
    }

    this.closePantryDialog();

    if (action === 'move') {
      const movedCount = await this.moveItemsToPantry(list);
      const success = await this.groceryService.completeGroceryList(list.id);
      if (!success) {
        this.error = 'Could not complete list.';
        this.cdr.detectChanges();
        return;
      }
      this.groceryList = {
        ...this.groceryList!,
        status: 'completed',
        updated_at: new Date().toISOString(),
      };
      this.showToast(
        movedCount === 1
          ? '1 item moved to pantry and list completed'
          : `${movedCount} items moved to pantry and list completed`
      );
      this.cdr.detectChanges();
      return;
    }
    if (action === 'skip') {
      const success = await this.groceryService.completeGroceryList(list.id);
      if (!success) {
        this.error = 'Could not complete list.';
        this.cdr.detectChanges();
        return;
      }
      this.groceryList = {
        ...this.groceryList!,
        status: 'completed',
        updated_at: new Date().toISOString(),
      };
      this.showCompletedUndoToast(this.groceryList);
      this.cdr.detectChanges();
    }
  }

  closePantryDialog(): void {
    this.isPantryDialogOpen = false;
    this.pantryDialogTitle = '';
    this.pantryDialogMessage = '';
    this.pantryDialogShowSkip = false;
    this.pendingPantryList = null;
  }

  async moveItemsToPantry(list: GroceryList): Promise<number> {
    try {
      const items = await this.groceryService.getItemsByListId(list.id);
      const itemsToMove = items.filter(
        (item: any) => item.status === 'bought' && !item.moved_to_pantry
      );
      for (const item of itemsToMove) {
        await this.pantryService.addOrIncrementPantryItem(item.name);
        await this.groceryService.updateGroceryItemMovedToPantry(
          item.id,
          true
        );
      }
      return itemsToMove.length;
    } catch (error) {
      console.error('Move to pantry failed:', error);
      this.error = 'Could not move items to pantry.';
      this.cdr.detectChanges();
      return 0;
    }
  }

  get coverageDays(): Array<{ label: string; meals: string[] }> {
    if (!this.groceryList?.generated || !this.groceryList.metadata?.days) {
      return [];
    }

    return this.groceryList.metadata.days
      .map((day: any) => {
        const meals = (day.meals || [])
          .map((m: any) => m?.name)
          .filter((name: string | undefined): name is string => !!name);

        if (!meals.length) {
          return null;
        }

        return {
          label: this.formatCoverageDay(day.key),
          meals,
        };
      })
      .filter(Boolean);
  }

  private formatCoverageDay(dateKey: string): string {
    const date = new Date(`${dateKey}T12:00:00`);

    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  }

  get coverageSummary(): string {
    if (!this.coverageDays.length) return '';

    const daysCount = this.coverageDays.length;
    const mealsCount = this.coverageDays.reduce(
      (sum, d) => sum + d.meals.length,
      0
    );

    const dayText = daysCount === 1 ? 'day' : 'days';
    const mealText = mealsCount === 1 ? 'meal' : 'meals';

    return `Covers planned meals · ${daysCount} ${dayText} · ${mealsCount} ${mealText}`;
  }

  isMeasurementStyleItem(name: string): boolean {
    const parsed = parseMeasurementStyleIngredient(name);
    return !!parsed;
  }

  onMeasurementHintClick(item: any, event: Event): void {
    event.stopPropagation();

    this.selectedMeasurementItem = item;

    const match = this.groceryItems.find(i =>
      getIngredientSortKey(i.name) === getIngredientSortKey(item.name) &&
      i.id !== item.id
    );

    this.selectedMeasurementItemMatchLabel = match ? match.name : null;

    this.isMeasurementSheetOpen = true;
  }

  async onMeasurementApply(event: { amount: number; unit: string; remember: boolean }) {
    if (!this.selectedMeasurementItem || !this.groceryList) {
      return;
    }

    const parsedMeasurement = parseMeasurementStyleIngredient(this.selectedMeasurementItem.name);
    const ingredientName = parsedMeasurement?.ingredient
      ? normalizeIngredientKey(parsedMeasurement.ingredient)
      : normalizeIngredientKey(this.selectedMeasurementItem.name);

    const newName = `${event.amount} ${event.unit} ${ingredientName}`.trim();

    const target = this.groceryItems.find((item) =>
      item.id !== this.selectedMeasurementItem.id &&
      getIngredientSortKey(item.name) === getIngredientSortKey(ingredientName)
    );

    let affectedId: string | null = null;

    if (target) {
      const merged = this.buildMergeResult(target.name, newName);

      if (merged) {
        const updateSuccess = await this.groceryService.updateGroceryItemName(
          target.id,
          merged
        );

        if (!updateSuccess) {
          this.error = 'Could not update grocery item.';
          this.cdr.detectChanges();
          return;
        }

        const deleteSuccess = await this.groceryService.deleteGroceryItem(
          this.selectedMeasurementItem.id
        );

        if (!deleteSuccess) {
          this.error = 'Could not delete grocery item.';
          this.cdr.detectChanges();
          return;
        }

        affectedId = target.id;
      } else {
        const updateSuccess = await this.groceryService.updateGroceryItemName(
          this.selectedMeasurementItem.id,
          newName
        );

        if (!updateSuccess) {
          this.error = 'Could not update grocery item.';
          this.cdr.detectChanges();
          return;
        }

        affectedId = this.selectedMeasurementItem.id;
      }
    } else {
      const updateSuccess = await this.groceryService.updateGroceryItemName(
        this.selectedMeasurementItem.id,
        newName
      );

      if (!updateSuccess) {
        this.error = 'Could not update grocery item.';
        this.cdr.detectChanges();
        return;
      }

      affectedId = this.selectedMeasurementItem.id;
    }

    if (event.remember && parsedMeasurement) {
      console.log('SAVE MEASUREMENT RULE:', {
        measure: parsedMeasurement.style,
        ingredient: ingredientName,
        amount: event.amount,
        unit: event.unit,
      });
    }

    this.isMeasurementSheetOpen = false;
    this.selectedMeasurementItem = null;
    this.selectedMeasurementItemMatchLabel = null;

    if (affectedId) {
      this.pendingRevealItemId = affectedId;
    }
  }

  onMeasurementSkip(): void {
    this.isMeasurementSheetOpen = false;
  }

  private revealItem(itemId: string): void {
    let attempts = 0;
    const maxAttempts = 12;
    const tryReveal = () => {
      const row = document.querySelector(
        `[data-item-id="${itemId}"]`
      ) as HTMLElement | null;
      if (!row) {
        attempts += 1;

        if (attempts < maxAttempts) {
          setTimeout(tryReveal, 80);
        }

        return;
      }
      const rect = row.getBoundingClientRect();
      const absoluteTop = rect.top + window.scrollY;
      const targetTop = Math.max(
        0,
        absoluteTop - window.innerHeight / 2 + rect.height / 2
      );
      window.scrollTo({
        top: targetTop,
        behavior: 'smooth',
      });
      row.classList.remove('grocery-item--reveal');
      void row.offsetWidth; // restart animation
      row.classList.add('grocery-item--reveal');

      setTimeout(() => {
        row.classList.remove('grocery-item--reveal');
      }, 1200);
    };

    setTimeout(tryReveal, 80);
  }

  private async getRememberedWordRuleForText(text: string): Promise<{
    singular_text: string;
    plural_text: string;
  } | null> {
    if (!this.groceryList?.space_id) {
      return null;
    }

    const rules = await this.ingredientRulesService.getWordRules(this.groceryList.space_id);

    const normalizedText = normalizeIngredientKey(text).trim().toLowerCase();

    return (
      rules.find(
        (rule) =>
          rule.singular_text.trim().toLowerCase() === normalizedText
      ) ?? null
    );
  }

  private async applyRememberedWordRuleForAdd(trimmedName: string): Promise<boolean> {
    const result = await this.applyRememberedCanonicalMergeForAddOrEdit(trimmedName);

    if (!result.handled) {
      return false;
    }

    if (result.revealItemId) {
      this.newItemName = '';
      this.pendingRevealItemId = result.revealItemId;
    }

    return true;
  }

  private async applyRememberedWordRuleForEdit(
    itemId: string,
    trimmedName: string
  ): Promise<boolean> {
    const result = await this.applyRememberedCanonicalMergeForAddOrEdit(trimmedName, {
      excludeItemId: itemId,
      deleteSourceItemId: itemId,
    });

    if (!result.handled) {
      return false;
    }

    if (result.revealItemId) {
      this.pendingRevealItemId = result.revealItemId;
    }

    return true;
  }

  private async saveRememberedWordRules(
    candidates: MergeCandidate[]
  ): Promise<void> {
    if (!this.groceryList?.space_id || !candidates.length) {
      return;
    }

    await this.ingredientRulesService.saveWordRules(
      candidates.map((candidate) => ({
        spaceId: this.groceryList!.space_id,
        singularText: candidate.singularText,
        pluralText: candidate.pluralText,
      }))
    );

    this.rememberedWordRules = await this.ingredientRulesService.getWordRules(
      this.groceryList.space_id
    );
  }


  private async filterRememberedCandidates(
    candidates: MergeCandidate[]
  ): Promise<MergeCandidate[]> {
    if (!this.groceryList?.space_id) {
      return candidates;
    }

    const rules = await this.ingredientRulesService.getWordRules(
      this.groceryList.space_id
    );

    this.rememberedWordRules = rules;

    return candidates.filter((candidate) => {
      const singular = normalizeIngredientKey(candidate.singularText);
      const plural = normalizeIngredientKey(candidate.pluralText);

      return !rules.some((rule) => {
        return (
          normalizeIngredientKey(rule.singular_text) === singular &&
          normalizeIngredientKey(rule.plural_text) === plural
        );
      });
    });
  }

  private async openMergeSheet(data: {
    rawIngredients: string[];
    newItem: string;
    candidates: MergeCandidate[];
  }): Promise<void> {
    this.cdr.detectChanges();

    await new Promise((resolve) => setTimeout(resolve, 0));

    this.mergeSheetData = data;
    this.isMergeSheetOpen = true;
    this.cdr.detectChanges();
  }

  private async applyRememberedCanonicalMergeForAddOrEdit(
    trimmedName: string,
    options?: { excludeItemId?: string; deleteSourceItemId?: string }
  ): Promise<{ handled: boolean; revealItemId?: string }> {
    if (!this.groceryList) {
      return { handled: false };
    }

    const rememberedRule = await this.getRememberedWordRuleForText(trimmedName);
    if (!rememberedRule) {
      return { handled: false };
    }

    const normalizedSingular = normalizeIngredientKey(rememberedRule.singular_text);
    const normalizedPlural = normalizeIngredientKey(rememberedRule.plural_text);

    const pluralCountedItem = this.groceryItems.find((item) => {
      if (item.id === options?.excludeItemId) return false;

      const info = getMergeableRawIngredientInfo(item.name);
      return (
        !!info &&
        info.kind === 'pluralish' &&
        normalizeIngredientKey(info.text) === normalizedPlural
      );
    });

    if (pluralCountedItem) {
      const info = getMergeableRawIngredientInfo(pluralCountedItem.name);
      if (!info) {
        return { handled: false };
      }

      const mergedName = `${info.count + 1} ${rememberedRule.plural_text}`.trim();

      const updateSuccess = await this.groceryService.updateGroceryItemName(
        pluralCountedItem.id,
        mergedName
      );

      if (!updateSuccess) {
        this.error = 'Could not update grocery item.';
        this.cdr.detectChanges();
        return { handled: true };
      }

      if (options?.deleteSourceItemId) {
        await this.groceryService.deleteGroceryItem(options.deleteSourceItemId);
      }

      return { handled: true, revealItemId: pluralCountedItem.id };
    }

    const singularPlainItem = this.groceryItems.find((item) => {
      if (item.id === options?.excludeItemId) return false;

      const normalizedItemName = normalizeIngredientKey(item.name);
      return normalizedItemName === normalizedSingular;
    });

    if (singularPlainItem) {
      const mergedName = `2 ${rememberedRule.plural_text}`.trim();

      const updateSuccess = await this.groceryService.updateGroceryItemName(
        singularPlainItem.id,
        mergedName
      );

      if (!updateSuccess) {
        this.error = 'Could not update grocery item.';
        this.cdr.detectChanges();
        return { handled: true };
      }

      if (options?.deleteSourceItemId) {
        await this.groceryService.deleteGroceryItem(options.deleteSourceItemId);
      }

      return { handled: true, revealItemId: singularPlainItem.id };
    }

    return { handled: false };
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.itemsChannel?.unsubscribe();
  }
}