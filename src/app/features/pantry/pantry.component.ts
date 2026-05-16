import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { FeatherModule } from 'angular-feather';
import { PageLoadingComponent } from '../../shared/components/page-loading/page-loading.component';
import { PantryService } from '../../services/pantry.service';
import { PantryItem } from '../../models/pantry-item.model';
import { Subject } from 'rxjs';
import { takeUntil, distinctUntilChanged } from 'rxjs/operators';
import { SpaceStateService } from '../../services/space.state.service';
import { AlwaysPresentPantryItem } from '../../models/always-present-pantry-item.model';
import {
  PantryItemDialogComponent,
  PantryItemDialogValue,
} from './pantry-item-dialog/pantry-item-dialog.component';
import { Router } from '@angular/router';
import { ConfirmationDialogComponent } from '../../shared/components/confirmation-dialog/confirmation-dialog.component';
import { SnackbarComponent } from '../../shared/components/snackbar/snackbar.component';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';
import { LanguageStateService } from '../../services/language.state.service';
import { RealtimeChannel } from '@supabase/supabase-js';
import {
  MergeReviewSheetComponent,
  MergeCandidate,
  MergeApplyValue,
} from '../../shared/components/merge-review-sheet/merge-review-sheet.component';

import {
  detectPossibleMergeCandidatesFromRawIngredients,
} from '../../shared/utils/ingredient-merge.util';

import { IngredientRulesService } from '../../services/ingredient-rules.service';
import {
  ResponsiveActionMenuComponent,
  ResponsiveActionMenuItem,
} from '../../shared/components/responsive-action-menu/responsive-action-menu';

@Component({
  selector: 'app-pantry',
  standalone: true,
  imports: [CommonModule, FormsModule, PageLoadingComponent, FeatherModule, PantryItemDialogComponent, ConfirmationDialogComponent, SnackbarComponent, TranslatePipe, MergeReviewSheetComponent, ResponsiveActionMenuComponent],

  templateUrl: './pantry.component.html',
  styleUrl: './pantry.component.scss',
})
export class PantryComponent implements OnInit, OnDestroy {
  isLoading = true;
  error = '';
  pantryItems: PantryItem[] = [];
  mode: 'all' | 'expiry' | 'recent' = 'all';
  alwaysPresentItems: AlwaysPresentPantryItem[] = [];
  isAlwaysPresentExpanded = false;
  isAddingAlwaysPresent = false;
  newAlwaysPresentName = '';

  isPantrySheetOpen = false;
  pantrySheetMode: 'add' | 'edit' = 'add';
  selectedPantryItem: PantryItem | null = null;

  isMergeSheetOpen = false;

  mergeSheetData: {
    rawIngredients: string[];
    newItem: string;
    candidates: MergeCandidate[];
  } | null = null;

  private pendingPantryValue: PantryItemDialogValue | null = null;
  private pendingEditPantryItemId: string | null = null;

  toastMessage: string | null = null;
  toastActionLabel: string | null = null;
  toastAction: (() => void) | null = null;
  toastTimeout: ReturnType<typeof setTimeout> | null = null;

  lastRemovedPantryItem: PantryItem | null = null;

  isDeleteDialogOpen = false;
  itemPendingDelete: PantryItem | null = null;

  pantrySearchQuery = '';

  private rememberedWordRules: any[] = [];
  private pantryChannel: RealtimeChannel | null = null;

  isCleanSheetOpen = false;
  isCleanConfirmOpen = false;
  selectedCleanAction: string | null = null;
  cleanConfirmTitle = '';
  cleanConfirmMessage = '';

  private destroy$ = new Subject<void>();

  constructor(
    private pantryService: PantryService,
    private spaceStateService: SpaceStateService,
    private cdr: ChangeDetectorRef,
    private router: Router,
    private ingredientRulesService: IngredientRulesService,
    private languageStateService: LanguageStateService
  ) { }

  @HostListener('document:click')
  onDocumentClick(): void {
    this.isCleanSheetOpen = false;
  }

  async ngOnInit(): Promise<void> {
    this.spaceStateService.currentSpace$
      .pipe(
        takeUntil(this.destroy$),
        distinctUntilChanged((prev, curr) => prev?.id === curr?.id)
      )
      .subscribe(async (space) => {
        this.resetPantryViewState();
        this.isLoading = true;
        this.error = '';
        if (!space) {
          this.pantryItems = [];
          this.alwaysPresentItems = [];
          this.pantryChannel?.unsubscribe();
          this.pantryChannel = null;
          this.isLoading = false;
          this.cdr.detectChanges();
          return;
        }
        try {
          await this.loadPantryItems();
          await this.loadAlwaysPresentItems();
          await this.loadRememberedWordRules();
          this.subscribeToPantryItems();
        } finally {
          this.isLoading = false;
          this.cdr.detectChanges();
        }
      });
  }

  private resetPantryViewState(): void {
    this.error = '';
    this.mode = 'all';
    this.isAlwaysPresentExpanded = false;
    this.isAddingAlwaysPresent = false;
    this.newAlwaysPresentName = '';
    this.isDeleteDialogOpen = false;
    this.itemPendingDelete = null;
    this.isPantrySheetOpen = false;
    this.pantrySheetMode = 'add';
    this.selectedPantryItem = null;
  }

  async loadPantryItems(): Promise<void> {
    try {
      this.pantryItems = await this.pantryService.getPantryItems();
    } catch (error) {
      console.error('Error loading pantry items:', error);
      this.error = this.languageStateService.t('pantry.loadError');
    }
  }

  getDisplayName(item: PantryItem): string {
    const name = item.name ?? '';
    if (item.unit === 'measured') {
      return name;
    }
    if (item.size_amount && item.size_unit) {
      return `${name} ${item.size_amount}${item.size_unit}`;
    }
    return name;
  }

  get allItems(): PantryItem[] {
    return this.filterItems([...this.pantryItems]);
  }

  get expiryItems(): PantryItem[] {
    return this.filterItems(
      [...this.pantryItems]
        .filter(item => !!item.expiry_date)
        .sort((a, b) => {
          const aTime = new Date(a.expiry_date as string).getTime();
          const bTime = new Date(b.expiry_date as string).getTime();
          return aTime - bTime;
        })
    );
  }

  get recentItems(): PantryItem[] {
    return this.filterItems(
      [...this.pantryItems].sort((a, b) => {
        const aTime = new Date(a.created_at).getTime();
        const bTime = new Date(b.created_at).getTime();
        return bTime - aTime;
      })
    );
  }

  async loadAlwaysPresentItems(): Promise<void> {
    try {
      const spaceId = this.spaceStateService.getCurrentSpace()?.id;
      if (!spaceId) {
        this.alwaysPresentItems = [];
        return;
      }
      this.alwaysPresentItems =
        await this.pantryService.getAlwaysPresentItems(spaceId);
    } catch (error) {
      console.error('Error loading always present items:', error);
      this.error = this.languageStateService.t('pantry.loadAlwaysPresentError');
    }
  }

  async incrementItem(item: PantryItem): Promise<void> {
    const nextAmount = item.amount + 1;
    const success = await this.pantryService.updatePantryItemAmount(
      item.id,
      nextAmount
    );

    if (!success) {
      this.error = this.languageStateService.t('pantry.updateQuantityError');
      this.cdr.detectChanges();
      return;
    }

    item.amount = nextAmount;
    this.cdr.detectChanges();
  }

  async decrementItem(item: PantryItem): Promise<void> {
    if (item.amount <= 1) {
      this.lastRemovedPantryItem = { ...item };
      const success = await this.pantryService.deletePantryItem(item.id);

      if (!success) {
        this.error = this.languageStateService.t('pantry.deleteError');
        this.lastRemovedPantryItem = null;
        this.cdr.detectChanges();
        return;
      }

      this.pantryItems = this.pantryItems.filter(
        (currentItem) => currentItem.id !== item.id
      );

      this.showToast(
        this.languageStateService
          .t('pantry.removedToast')
          .replace('{{name}}', item.name),
        this.languageStateService.t('common.undo'),
        () => {
          this.undoLastRemovedItem();
        }
      );

      this.cdr.detectChanges();
      return;
    }

    const nextAmount = item.amount - 1;

    const success = await this.pantryService.updatePantryItemAmount(
      item.id,
      nextAmount
    );

    if (!success) {
      this.error = this.languageStateService.t('pantry.updateQuantityError');
      this.cdr.detectChanges();
      return;
    }

    item.amount = nextAmount;
    this.cdr.detectChanges();
  }

  deleteItem(item: PantryItem): void {
    this.itemPendingDelete = item;
    this.isDeleteDialogOpen = true;
    this.cdr.detectChanges();
  }

  cancelDeleteItem(): void {
    this.isDeleteDialogOpen = false;
    this.itemPendingDelete = null;
    this.cdr.detectChanges();
  }

  async confirmDeleteItem(): Promise<void> {
    if (!this.itemPendingDelete) {
      return;
    }

    const item = this.itemPendingDelete;

    const success = await this.pantryService.deletePantryItem(item.id);

    if (!success) {
      this.error = this.languageStateService.t('pantry.deleteError');
      this.cdr.detectChanges();
      return;
    }

    this.pantryItems = this.pantryItems.filter(
      (currentItem) => currentItem.id !== item.id
    );

    this.isDeleteDialogOpen = false;
    this.itemPendingDelete = null;


    this.lastRemovedPantryItem = null;
    this.showToast(
      this.languageStateService
        .t('pantry.removedToast')
        .replace('{{name}}', item.name)
    );

    this.cdr.detectChanges();
  }

  onAddItem(): void {
    this.pantrySheetMode = 'add';
    this.selectedPantryItem = null;
    this.isPantrySheetOpen = true;
    this.cdr.detectChanges();
  }

  onEditItem(item: PantryItem): void {
    this.pantrySheetMode = 'edit';
    this.selectedPantryItem = item;
    this.isPantrySheetOpen = true;
    this.cdr.detectChanges();
  }

  onCleanPantry(event?: Event): void {
    event?.stopPropagation();
    this.isCleanSheetOpen = !this.isCleanSheetOpen;
    this.cdr.detectChanges();
  }

  isMobileViewport(): boolean {
    return window.innerWidth < 1200;
  }

  closeCleanSheet(): void {
    this.isCleanSheetOpen = false;
    this.cdr.detectChanges();
  }

  onCleanActionSelected(actionId: string): void {
    this.selectedCleanAction = actionId;
    this.isCleanSheetOpen = false;

    const count = this.getCleanCandidateCount(actionId);

    if (count === 0) {
      this.selectedCleanAction = null;
      this.isCleanConfirmOpen = false;
      this.showToast(this.languageStateService.t('pantry.cleanNothingToRemove'));
      this.cdr.detectChanges();
      return;
    }

    this.cleanConfirmTitle = this.languageStateService.t('pantry.cleanConfirmTitle');
    this.cleanConfirmMessage =
      count === 1
        ? this.languageStateService.t('pantry.cleanConfirmMessageOne')
        : this.languageStateService
          .t('pantry.cleanConfirmMessageMany')
          .replace('{{count}}', String(count));
    this.isCleanConfirmOpen = true;
    this.cdr.detectChanges();
  }

  cancelCleanConfirm(): void {
    this.isCleanConfirmOpen = false;
    this.selectedCleanAction = null;
    this.cleanConfirmTitle = '';
    this.cleanConfirmMessage = '';
    this.cdr.detectChanges();
  }

  async confirmCleanPantry(): Promise<void> {
    if (!this.selectedCleanAction) {
      this.cancelCleanConfirm();
      return;
    }
    const items = this.getCleanCandidates(this.selectedCleanAction);
    const itemIds = items.map((item) => item.id);
    if (!itemIds.length) {
      this.cancelCleanConfirm();
      return;
    }
    const success = await this.pantryService.deletePantryItems(itemIds);
    if (!success) {
      this.error = this.languageStateService.t('pantry.deleteError');
      this.cancelCleanConfirm();
      this.cdr.detectChanges();
      return;
    }
    await this.loadPantryItems();
    this.showToast(
      this.languageStateService
        .t(items.length === 1 ? 'pantry.cleanRemovedOne' : 'pantry.cleanRemovedMany')
        .replace('{{count}}', String(items.length))
    );
    this.cancelCleanConfirm();
    this.cdr.detectChanges();
  }

  private getCleanCandidateCount(actionId: string): number {
    return this.getCleanCandidates(actionId).length;
  }

  private getCleanCandidates(actionId: string): PantryItem[] {
    const now = new Date();

    if (actionId === 'expired') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      return this.pantryItems.filter((item) => {
        if (!item.expiry_date) return false;

        const expiry = new Date(item.expiry_date);
        expiry.setHours(0, 0, 0, 0);

        return expiry < today;
      });
    }

    const daysMap: Record<string, number> = {
      'added-1-day': 1,
      'added-7-days': 7,
      'added-30-days': 30,
    };

    const days = daysMap[actionId];

    if (!days) {
      return [];
    }

    const cutoff = new Date(now);
    cutoff.setDate(cutoff.getDate() - days);

    return this.pantryItems.filter((item) => {
      if (!item.created_at) return false;

      return new Date(item.created_at) >= cutoff;
    });
  }

  setMode(mode: 'all' | 'expiry' | 'recent'): void {
    this.mode = mode;
    this.pantrySearchQuery = '';
    this.cdr.detectChanges();
  }

  toggleAlwaysPresent(): void {
    this.isAlwaysPresentExpanded = !this.isAlwaysPresentExpanded;
    this.cdr.detectChanges();
  }

  startAddingAlwaysPresent(): void {
    this.isAddingAlwaysPresent = true;
    this.newAlwaysPresentName = '';
  }

  cancelAddingAlwaysPresent(): void {
    this.isAddingAlwaysPresent = false;
    this.newAlwaysPresentName = '';
  }

  closePantrySheet(): void {
    this.isPantrySheetOpen = false;
    this.selectedPantryItem = null;
    this.pantrySheetMode = 'add';
    this.cdr.detectChanges();
  }

  private async applyRememberedPantryMergeIfPossible(
    value: PantryItemDialogValue,
    matchingCandidates: MergeCandidate[]
  ): Promise<boolean> {
    const rememberedCandidate = matchingCandidates.find((candidate) =>
      this.isMergeCandidateRemembered(candidate)
    );

    if (!rememberedCandidate) {
      return false;
    }

    const singularName = rememberedCandidate.singularText.trim().toLowerCase();
    const pluralName = rememberedCandidate.pluralText.trim().toLowerCase();

    const singularItems = this.pantryItems.filter((item) =>
      item.unit !== 'measured' &&
      !item.size_amount &&
      !item.size_unit &&
      item.name.trim().toLowerCase() === singularName
    );

    const targetPluralItem = this.pantryItems.find((item) =>
      item.unit !== 'measured' &&
      !item.size_amount &&
      !item.size_unit &&
      item.name.trim().toLowerCase() === pluralName
    );

    const incomingAmount = Number(value.amount ?? 1);
    const singularAmount = singularItems.reduce(
      (sum, item) => sum + Number(item.amount ?? 1),
      0
    );

    const totalAmount =
      Number(targetPluralItem?.amount ?? 0) + incomingAmount + singularAmount;

    let affectedItem: PantryItem | null = null;

    if (targetPluralItem) {
      const success = await this.pantryService.updatePantryItemAmount(
        targetPluralItem.id,
        totalAmount
      );

      if (!success) {
        this.error = this.languageStateService.t('pantry.updateQuantityError');
        this.cdr.detectChanges();
        return true;
      }

      affectedItem = targetPluralItem;
    } else {
      affectedItem = await this.pantryService.createPantryItem({
        name: pluralName,
        amount: totalAmount,
        unit: 'item',
        size_amount: null,
        size_unit: null,
        expiry_date: value.expiry_date,
      });

      if (!affectedItem) {
        this.error = this.languageStateService.t('pantry.createError');
        this.cdr.detectChanges();
        return true;
      }
    }

    for (const item of singularItems) {
      await this.pantryService.deletePantryItem(item.id);
    }

    await this.loadPantryItems();
    this.revealPantryItem(affectedItem.id);
    this.closePantrySheet();
    this.lastRemovedPantryItem = null;

    this.showToast(
      this.languageStateService
        .t('pantry.addedToast')
        .replace('{{name}}', value.name)
    );

    return true;
  }

  private async applyRememberedPantryMergeForEditIfPossible(
    itemId: string,
    value: PantryItemDialogValue,
    matchingCandidates: MergeCandidate[]
  ): Promise<boolean> {
    const rememberedCandidate = matchingCandidates.find((candidate) =>
      this.isMergeCandidateRemembered(candidate)
    );

    if (!rememberedCandidate) {
      return false;
    }

    if (
      value.unit === 'measured' ||
      value.size_amount ||
      value.size_unit
    ) {
      return false;
    }

    const singularName = rememberedCandidate.singularText.trim().toLowerCase();
    const pluralName = rememberedCandidate.pluralText.trim().toLowerCase();

    const singularItems = this.pantryItems.filter((item) =>
      item.id !== itemId &&
      item.unit !== 'measured' &&
      !item.size_amount &&
      !item.size_unit &&
      item.name.trim().toLowerCase() === singularName
    );

    const targetPluralItem = this.pantryItems.find((item) =>
      item.id !== itemId &&
      item.unit !== 'measured' &&
      !item.size_amount &&
      !item.size_unit &&
      item.name.trim().toLowerCase() === pluralName
    );

    const incomingAmount = Number(value.amount ?? 1);
    const singularAmount = singularItems.reduce(
      (sum, item) => sum + Number(item.amount ?? 1),
      0
    );

    const totalAmount =
      Number(targetPluralItem?.amount ?? 0) + incomingAmount + singularAmount;

    let affectedItem: PantryItem | null = null;

    if (targetPluralItem) {
      const success = await this.pantryService.updatePantryItemAmount(
        targetPluralItem.id,
        totalAmount
      );

      if (!success) {
        this.error = this.languageStateService.t('pantry.updateQuantityError');
        this.cdr.detectChanges();
        return true;
      }

      await this.pantryService.deletePantryItem(itemId);
      affectedItem = targetPluralItem;
    } else {
      affectedItem = await this.pantryService.updatePantryItem(itemId, {
        name: pluralName,
        amount: totalAmount,
        unit: 'item',
        size_amount: null,
        size_unit: null,
        expiry_date: value.expiry_date,
      });

      if (!affectedItem) {
        this.error = this.languageStateService.t('pantry.updateError');
        this.cdr.detectChanges();
        return true;
      }
    }

    for (const item of singularItems) {
      await this.pantryService.deletePantryItem(item.id);
    }

    await this.loadPantryItems();
    this.revealPantryItem(affectedItem.id);
    this.closePantrySheet();
    this.lastRemovedPantryItem = null;

    this.showToast(
      this.languageStateService
        .t('pantry.updatedToast')
        .replace('{{name}}', value.name)
    );

    return true;
  }

  async savePantryItem(value: PantryItemDialogValue): Promise<void> {
    this.error = '';

    if (this.pantrySheetMode === 'add') {
      const rawIngredients =
        this.buildPantryMergeRawIngredients(value);

      const candidates =
        detectPossibleMergeCandidatesFromRawIngredients(rawIngredients);

      if (candidates.length > 0) {
        const matchingCandidates = candidates.filter((candidate) => {
          const lowerName = value.name.trim().toLowerCase();

          return (
            candidate.pluralText.toLowerCase() === lowerName ||
            candidate.singularText.toLowerCase() === lowerName
          );
        });

        const unrememberedCandidates = matchingCandidates.filter(
          (candidate) => !this.isMergeCandidateRemembered(candidate)
        );

        const didApplyRememberedMerge =
          await this.applyRememberedPantryMergeIfPossible(value, matchingCandidates);

        if (didApplyRememberedMerge) {
          return;
        }

        if (unrememberedCandidates.length > 0) {
          this.pendingPantryValue = value;
          this.pendingEditPantryItemId = null;

          this.mergeSheetData = {
            rawIngredients,
            newItem: value.name,
            candidates: unrememberedCandidates,
          };

          this.isMergeSheetOpen = true;
          this.cdr.detectChanges();
          return;
        }
      }

      const created = await this.pantryService.createPantryItem({
        name: value.name,
        amount: value.amount,
        unit: value.unit,
        size_amount: value.size_amount,
        size_unit: value.size_unit,
        expiry_date: value.expiry_date,
      });

      if (!created) {
        this.error = this.languageStateService.t('pantry.createError');
        this.cdr.detectChanges();
        return;
      }

      await this.loadPantryItems();
      this.revealPantryItem(created.id);
      this.closePantrySheet();
      this.lastRemovedPantryItem = null;
      this.showToast(
        this.languageStateService
          .t('pantry.addedToast')
          .replace('{{name}}', value.name)
      );
      return;
    }

    if (!this.selectedPantryItem) {
      return;
    }

    const rawIngredients =
      this.buildPantryMergeRawIngredients(value);

    const candidates =
      detectPossibleMergeCandidatesFromRawIngredients(rawIngredients);

    if (candidates.length > 0) {
      const matchingCandidates = candidates.filter((candidate) => {
        const lowerName = value.name.trim().toLowerCase();

        return (
          candidate.pluralText.toLowerCase() === lowerName ||
          candidate.singularText.toLowerCase() === lowerName
        );
      });

      const didApplyRememberedEditMerge =
        await this.applyRememberedPantryMergeForEditIfPossible(
          this.selectedPantryItem.id,
          value,
          matchingCandidates
        );

      if (didApplyRememberedEditMerge) {
        return;
      }
      const unrememberedCandidates = matchingCandidates.filter(
        (candidate) => !this.isMergeCandidateRemembered(candidate)
      );

      if (unrememberedCandidates.length > 0) {
        this.pendingPantryValue = value;
        this.pendingEditPantryItemId = this.selectedPantryItem.id;

        this.mergeSheetData = {
          rawIngredients,
          newItem: value.name,
          candidates: unrememberedCandidates,
        };

        this.isMergeSheetOpen = true;
        this.cdr.detectChanges();
        return;
      }
    }

    const updatedItem = await this.pantryService.updatePantryItem(this.selectedPantryItem.id, {
      name: value.name,
      amount: value.amount,
      unit: value.unit,
      size_amount: value.size_amount,
      size_unit: value.size_unit,
      expiry_date: value.expiry_date,
    });

    if (!updatedItem) {
      this.error = this.languageStateService.t('pantry.updateError');
      this.cdr.detectChanges();
      return;
    }

    await this.loadPantryItems();
    this.revealPantryItem(updatedItem.id);
    this.closePantrySheet();
    this.lastRemovedPantryItem = null;
    this.showToast(
      this.languageStateService
        .t('pantry.updatedToast')
        .replace('{{name}}', value.name)
    );
  }

  async addAlwaysPresentItem(): Promise<void> {
    const trimmedName = this.newAlwaysPresentName.trim();
    if (!trimmedName) {
      return;
    }

    const created = await this.pantryService.addAlwaysPresentItem(trimmedName);

    if (!created) {
      this.error = this.languageStateService.t('pantry.addAlwaysPresentError');
      this.cdr.detectChanges();
      return;
    }

    this.alwaysPresentItems = [created, ...this.alwaysPresentItems];
    this.newAlwaysPresentName = '';
    this.isAddingAlwaysPresent = false;
    this.cdr.detectChanges();
  }

  async deleteAlwaysPresentItem(item: AlwaysPresentPantryItem): Promise<void> {
    const success = await this.pantryService.deleteAlwaysPresentItem(item.id);

    if (!success) {
      this.error = this.languageStateService.t('pantry.deleteAlwaysPresentError');
      this.cdr.detectChanges();
      return;
    }

    this.alwaysPresentItems = this.alwaysPresentItems.filter(
      (currentItem) => currentItem.id !== item.id
    );
    this.cdr.detectChanges();
  }

  private showToast(
    message: string,
    actionLabel?: string,
    action?: () => void
  ): void {
    this.toastMessage = message;
    this.toastActionLabel = actionLabel ?? null;
    this.toastAction = action ?? null;
    this.cdr.detectChanges();

    if (this.toastTimeout) {
      clearTimeout(this.toastTimeout);
    }

    this.toastTimeout = setTimeout(() => {
      this.clearToast();
    }, 2500);
  }

  onToastAction(): void {
    if (this.toastAction) {
      this.toastAction();
    }
    this.clearToast();
  }

  async undoLastRemovedItem(): Promise<void> {
    if (!this.lastRemovedPantryItem) {
      return;
    }

    const item = this.lastRemovedPantryItem;

    const restored = await this.pantryService.createPantryItem({
      name: item.name,
      amount: item.amount,
      unit: item.unit,
      size_amount: item.size_amount,
      size_unit: item.size_unit,
      expiry_date: item.expiry_date ?? null,
    });

    if (!restored) {
      this.error = this.languageStateService.t('pantry.restoreError');
      this.cdr.detectChanges();
      return;
    }

    await this.loadPantryItems();
    this.lastRemovedPantryItem = null;
    this.showToast(
      this.languageStateService
        .t('pantry.restoredToast')
        .replace('{{name}}', item.name)
    );
  }

  private clearToast(): void {
    this.toastMessage = null;
    this.toastActionLabel = null;
    this.toastAction = null;
    this.cdr.detectChanges();
  }

  goToCookFromPantry(): void {
    this.router.navigate(['/cook-from-pantry'], {
      queryParams: { source: 'pantry' }
    });
  }

  clearPantrySearch(): void {
    this.pantrySearchQuery = '';
    this.cdr.detectChanges();
  }

  private buildPantryMergeRawIngredients(
    incomingValue?: PantryItemDialogValue
  ): string[] {
    const raw = this.pantryItems
      .filter((item) => item.unit !== 'measured')
      .filter((item) => !item.size_amount && !item.size_unit)
      .map((item) => {
        const amount = Number(item.amount ?? 1);

        return amount > 1
          ? `${amount} ${item.name}`
          : item.name;
      });

    if (
      incomingValue &&
      incomingValue.unit !== 'measured' &&
      !incomingValue.size_amount &&
      !incomingValue.size_unit
    ) {
      const amount = Number(incomingValue.amount ?? 1);

      raw.push(
        amount > 1
          ? `${amount} ${incomingValue.name}`
          : incomingValue.name
      );
    }

    return raw;
  }

  private filterItems(items: PantryItem[]): PantryItem[] {
    const query = this.pantrySearchQuery.trim().toLowerCase();

    if (!query) return items;

    return items.filter(item =>
      this.getDisplayName(item).toLowerCase().includes(query)
    );
  }


  private subscribeToPantryItems(): void {
    this.pantryChannel?.unsubscribe();

    const spaceId = this.spaceStateService.getCurrentSpace()?.id;

    if (!spaceId) {
      return;
    }

    this.pantryChannel = this.pantryService.supabase
      .channel(`pantry-items-${spaceId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'pantry_items',
          filter: `space_id=eq.${spaceId}`,
        },
        async () => {
          setTimeout(async () => {
            this.pantryItems = await this.pantryService.getPantryItems();
            this.cdr.detectChanges();
          }, 120);
        }
      )
      .subscribe();
  }

  private revealPantryItem(itemId: string): void {
    let attempts = 0;
    const maxAttempts = 12;

    const tryReveal = () => {
      const row = document.querySelector(
        `[data-pantry-item-id="${itemId}"]`
      ) as HTMLElement | null;

      if (!row) {
        attempts += 1;

        if (attempts < maxAttempts) {
          setTimeout(tryReveal, 80);
        }

        return;
      }

      row.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });

      row.classList.remove('pantry-item-row--reveal');
      void row.offsetWidth;
      row.classList.add('pantry-item-row--reveal');

      setTimeout(() => {
        row.classList.remove('pantry-item-row--reveal');
      }, 1400);
    };

    setTimeout(tryReveal, 80);
  }

  async onMergeCancel(): Promise<void> {
    this.isMergeSheetOpen = false;
    this.mergeSheetData = null;
    this.pendingPantryValue = null;
    this.pendingEditPantryItemId = null;
    this.cdr.detectChanges();
  }

  async onMergeSkip(): Promise<void> {
    const value = this.pendingPantryValue;
    const editItemId = this.pendingEditPantryItemId;

    this.isMergeSheetOpen = false;
    this.mergeSheetData = null;
    this.pendingPantryValue = null;
    this.pendingEditPantryItemId = null;

    if (!value) {
      this.cdr.detectChanges();
      return;
    }

    if (editItemId) {
      const updatedItem = await this.pantryService.updatePantryItem(editItemId, {
        name: value.name,
        amount: value.amount,
        unit: value.unit,
        size_amount: value.size_amount,
        size_unit: value.size_unit,
        expiry_date: value.expiry_date,
      });

      if (!updatedItem) {
        this.error = this.languageStateService.t('pantry.updateError');
        this.cdr.detectChanges();
        return;
      }

      await this.loadPantryItems();
      this.revealPantryItem(updatedItem.id);
      this.closePantrySheet();

      this.showToast(
        this.languageStateService
          .t('pantry.updatedToast')
          .replace('{{name}}', value.name)
      );

      return;
    }

    const created = await this.pantryService.createPantryItem({
      name: value.name,
      amount: value.amount,
      unit: value.unit,
      size_amount: value.size_amount,
      size_unit: value.size_unit,
      expiry_date: value.expiry_date,
    });

    if (!created) {
      this.error = this.languageStateService.t('pantry.createError');
      this.cdr.detectChanges();
      return;
    }

    await this.loadPantryItems();
    this.revealPantryItem(created.id);
    this.closePantrySheet();

    this.showToast(
      this.languageStateService
        .t('pantry.addedToast')
        .replace('{{name}}', value.name)
    );
  }

  async onMergeApply(value: MergeApplyValue): Promise<void> {
    if (!this.mergeSheetData || !this.pendingPantryValue) {
      return;
    }

    const { selectedCandidates, remember } = value;

    if (remember && selectedCandidates.length) {
      await this.saveRememberedWordRules(selectedCandidates);
    }

    this.isMergeSheetOpen = false;

    if (!selectedCandidates.length) {
      await this.onMergeSkip();
      return;
    }

    let revealTargetId: string | null = null;

    for (const candidate of selectedCandidates) {
      const targetId = await this.applySingleMergeCandidateToPantry(
        candidate,
        this.pendingPantryValue,
        this.pendingEditPantryItemId
      );

      if (!revealTargetId && targetId) {
        revealTargetId = targetId;
      }
    }

    this.showToast(
      this.languageStateService
        .t(this.pendingEditPantryItemId ? 'pantry.updatedToast' : 'pantry.addedToast')
        .replace('{{name}}', this.pendingPantryValue?.name ?? '')
    );

    this.mergeSheetData = null;
    this.pendingPantryValue = null;
    this.pendingEditPantryItemId = null;

    await this.loadPantryItems();

    if (revealTargetId) {
      this.revealPantryItem(revealTargetId);
    }

    this.closePantrySheet();
  }

  private async saveRememberedWordRules(
    candidates: MergeCandidate[]
  ): Promise<void> {
    const spaceId = this.spaceStateService.getCurrentSpace()?.id;

    if (!spaceId || !candidates.length) {
      return;
    }

    await this.ingredientRulesService.saveWordRules(
      candidates.map((candidate) => ({
        spaceId,
        singularText: candidate.singularText,
        pluralText: candidate.pluralText,
      }))
    );

    this.rememberedWordRules =
      await this.ingredientRulesService.getWordRules(spaceId);
  }

  private async applySingleMergeCandidateToPantry(
    candidate: MergeCandidate,
    pendingValue: PantryItemDialogValue,
    pendingEditItemId: string | null
  ): Promise<string | null> {
    const singularName = candidate.singularText.trim().toLowerCase();
    const pluralName = candidate.pluralText.trim().toLowerCase();

    const matchingItems = this.pantryItems.filter((item) => {
      if (pendingEditItemId && item.id === pendingEditItemId) {
        return false;
      }

      return (
        item.unit !== 'measured' &&
        !item.size_amount &&
        !item.size_unit &&
        (
          item.name.trim().toLowerCase() === singularName ||
          item.name.trim().toLowerCase() === pluralName
        )
      );
    });

    const incomingAmount = Number(pendingValue.amount ?? 1);

    const existingAmount = matchingItems.reduce(
      (sum, item) => sum + Number(item.amount ?? 1),
      0
    );

    const totalAmount = existingAmount + incomingAmount;

    const targetPluralItem =
      matchingItems.find((item) => item.name.trim().toLowerCase() === pluralName) ??
      null;

    let affectedItem: PantryItem | null = null;

    if (targetPluralItem) {
      const success = await this.pantryService.updatePantryItemAmount(
        targetPluralItem.id,
        totalAmount
      );

      if (!success) {
        this.error = this.languageStateService.t('pantry.updateQuantityError');
        this.cdr.detectChanges();
        return null;
      }

      affectedItem = targetPluralItem;
    } else if (pendingEditItemId) {
      affectedItem = await this.pantryService.updatePantryItem(pendingEditItemId, {
        name: pluralName,
        amount: totalAmount,
        unit: 'item',
        size_amount: null,
        size_unit: null,
        expiry_date: pendingValue.expiry_date,
      });

      if (!affectedItem) {
        this.error = this.languageStateService.t('pantry.updateError');
        this.cdr.detectChanges();
        return null;
      }
    } else {
      affectedItem = await this.pantryService.createPantryItem({
        name: pluralName,
        amount: totalAmount,
        unit: 'item',
        size_amount: null,
        size_unit: null,
        expiry_date: pendingValue.expiry_date,
      });

      if (!affectedItem) {
        this.error = this.languageStateService.t('pantry.createError');
        this.cdr.detectChanges();
        return null;
      }
    }

    for (const item of matchingItems) {
      if (item.id !== affectedItem.id) {
        await this.pantryService.deletePantryItem(item.id);
      }
    }

    if (pendingEditItemId && pendingEditItemId !== affectedItem.id) {
      await this.pantryService.deletePantryItem(pendingEditItemId);
    }

    return affectedItem.id;
  }

  private async loadRememberedWordRules(): Promise<void> {
    const spaceId = this.spaceStateService.getCurrentSpace()?.id;
    if (!spaceId) {
      this.rememberedWordRules = [];
      return;
    }
    this.rememberedWordRules =
      await this.ingredientRulesService.getWordRules(spaceId);
  }

  private isMergeCandidateRemembered(candidate: MergeCandidate): boolean {
    const singular = candidate.singularText.trim().toLowerCase();
    const plural = candidate.pluralText.trim().toLowerCase();

    return this.rememberedWordRules.some((rule: any) => {
      const ruleSingular =
        (rule.singular_text ?? rule.singularText ?? rule.singular ?? '')
          .trim()
          .toLowerCase();

      const rulePlural =
        (rule.plural_text ?? rule.pluralText ?? rule.plural ?? rule.canonical_text ?? rule.canonicalText ?? '')
          .trim()
          .toLowerCase();

      return ruleSingular === singular && rulePlural === plural;
    });
  }

  get cleanActions(): ResponsiveActionMenuItem[] {
    return [
      {
        id: 'expired',
        label: this.languageStateService.t('pantry.cleanExpired'),
      },
      {
        id: 'added-1-day',
        label: this.languageStateService.t('pantry.cleanAddedLastDay'),
      },
      {
        id: 'added-7-days',
        label: this.languageStateService.t('pantry.cleanAddedLast7Days'),
      },
      {
        id: 'added-30-days',
        label: this.languageStateService.t('pantry.cleanAddedLast30Days'),
      },
    ];
  }

  ngOnDestroy(): void {
    if (this.toastTimeout) {
      clearTimeout(this.toastTimeout);
    }

    this.pantryChannel?.unsubscribe();
    this.pantryChannel = null;

    this.destroy$.next();
    this.destroy$.complete();
  }
}