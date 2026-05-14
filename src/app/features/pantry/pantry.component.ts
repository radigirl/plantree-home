import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { FeatherModule } from 'angular-feather';
import { PageLoadingComponent } from '../../shared/components/page-loading/page-loading.component';
import { PantryService } from '../../services/pantry.service';
import { PantryItem } from '../../models/pantry-item.model';
import { Subject } from 'rxjs';
import { takeUntil, distinctUntilChanged } from 'rxjs/operators';
import { SpaceStateService } from '../../services/space.state.service';
import { AlwaysPresentPantryItem } from '../../models/always-present-pantry-item.model';
import { PantryItemSheetComponent, PantryItemSheetValue } from '../../shared/components/pantry-item-sheet/pantry-item-sheet.component';
import { Router } from '@angular/router';
import { ConfirmationDialogComponent } from '../../shared/components/confirmation-dialog/confirmation-dialog.component';
import { SnackbarComponent } from '../../shared/components/snackbar/snackbar.component';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';
import { LanguageStateService } from '../../services/language.state.service';
import { RealtimeChannel } from '@supabase/supabase-js';

@Component({
  selector: 'app-pantry',
  standalone: true,
  imports: [CommonModule, FormsModule, PageLoadingComponent, FeatherModule, PantryItemSheetComponent, ConfirmationDialogComponent, SnackbarComponent, TranslatePipe],

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


  toastMessage: string | null = null;
  toastActionLabel: string | null = null;
  toastAction: (() => void) | null = null;
  toastTimeout: ReturnType<typeof setTimeout> | null = null;

  lastRemovedPantryItem: PantryItem | null = null;

  isDeleteDialogOpen = false;
  itemPendingDelete: PantryItem | null = null;

  pantrySearchQuery = '';
  private suppressNextRealtimeReveal = false;
  private pantryChannel: RealtimeChannel | null = null;

  private destroy$ = new Subject<void>();

  constructor(
    private pantryService: PantryService,
    private spaceStateService: SpaceStateService,
    private cdr: ChangeDetectorRef,
    private router: Router,
    private languageStateService: LanguageStateService
  ) { }

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

    this.suppressNextRealtimeReveal = true;

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

      this.suppressNextRealtimeReveal = true;

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

    this.suppressNextRealtimeReveal = true;

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

    this.suppressNextRealtimeReveal = true;

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

  onCleanPantry(): void {
    console.log('Clean pantry');
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

  async savePantryItem(value: PantryItemSheetValue): Promise<void> {
    this.error = '';

    if (this.pantrySheetMode === 'add') {
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

    const success = await this.pantryService.updatePantryItem(this.selectedPantryItem.id, {
      name: value.name,
      amount: value.amount,
      unit: value.unit,
      size_amount: value.size_amount,
      size_unit: value.size_unit,
      expiry_date: value.expiry_date,
    });

    if (!success) {
      this.error = this.languageStateService.t('pantry.updateError');
      this.cdr.detectChanges();
      return;
    }

    await this.loadPantryItems();
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
        async (payload) => {
          const changedItemId =
            payload.eventType === 'DELETE'
              ? null
              : (payload.new as PantryItem | null)?.id ?? null;

          setTimeout(async () => {
            this.pantryItems = await this.pantryService.getPantryItems();
            this.cdr.detectChanges();

            if (this.suppressNextRealtimeReveal) {
              this.suppressNextRealtimeReveal = false;
              return;
            }

            if (changedItemId) {
              this.revealPantryItem(changedItemId);
            }
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