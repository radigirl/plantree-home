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

@Component({
  selector: 'app-pantry',
  standalone: true,
  imports: [CommonModule, FormsModule, PageLoadingComponent, FeatherModule, PantryItemSheetComponent],
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
  toastTimeout: any = null;

  private destroy$ = new Subject<void>();

  constructor(
    private pantryService: PantryService,
    private spaceStateService: SpaceStateService,
    private cdr: ChangeDetectorRef
  ) { }

  async ngOnInit(): Promise<void> {
    this.spaceStateService.currentSpace$
      .pipe(
        takeUntil(this.destroy$),
        distinctUntilChanged((prev, curr) => prev?.id === curr?.id)
      )
      .subscribe(async (space) => {
        this.resetPantryViewState();

        if (!space) {
          this.pantryItems = [];
          this.alwaysPresentItems = [];
          this.isLoading = false;
          this.cdr.detectChanges();
          return;
        }

        await this.loadPantryItems();
        await this.loadAlwaysPresentItems();
      });
  }

  private resetPantryViewState(): void {
    this.error = '';
    this.mode = 'all';
    this.isAlwaysPresentExpanded = false;
    this.isAddingAlwaysPresent = false;
    this.newAlwaysPresentName = '';

    this.isPantrySheetOpen = false;
    this.pantrySheetMode = 'add';
    this.selectedPantryItem = null;
  }

  async loadPantryItems(): Promise<void> {
    this.isLoading = true;
    this.error = '';

    try {
      this.pantryItems = await this.pantryService.getPantryItems();
    } catch (error) {
      console.error('Error loading pantry items:', error);
      this.error = 'Could not load pantry items.';
    } finally {
      this.isLoading = false;
      this.cdr.detectChanges();
    }
  }


  getDisplayName(item: PantryItem): string {
    const hasSize =
      item.size_amount !== null &&
      item.size_amount !== undefined &&
      item.size_unit;

    if (!hasSize) {
      return item.name;
    }

    return `${item.name} ${item.size_amount}${item.size_unit}`;
  }

  get allItems(): PantryItem[] {
    return [...this.pantryItems];
  }

  get expiryItems(): PantryItem[] {
    return [...this.pantryItems]
      .filter((item) => !!item.expiry_date)
      .sort((a, b) => {
        const aTime = new Date(a.expiry_date as string).getTime();
        const bTime = new Date(b.expiry_date as string).getTime();
        return aTime - bTime;
      });
  }

  get noExpiryItems(): PantryItem[] {
    return [...this.pantryItems].filter((item) => !item.expiry_date);
  }

  get recentItems(): PantryItem[] {
    return [...this.pantryItems]
      .sort((a, b) => {
        const aTime = new Date(a.created_at).getTime();
        const bTime = new Date(b.created_at).getTime();
        return bTime - aTime;
      })
      .slice(0, 6);
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
      this.error = 'Could not load always present items.';
    } finally {
      this.cdr.detectChanges();
    }
  }

  async incrementItem(item: PantryItem): Promise<void> {
    const nextAmount = item.amount + 1;

    const success = await this.pantryService.updatePantryItemAmount(
      item.id,
      nextAmount
    );

    if (!success) {
      this.error = 'Could not update pantry quantity.';
      this.cdr.detectChanges();
      return;
    }

    item.amount = nextAmount;
    this.cdr.detectChanges();
  }

  async decrementItem(item: PantryItem): Promise<void> {
    if (item.amount <= 1) {
      const success = await this.pantryService.deletePantryItem(item.id);

      if (!success) {
        this.error = 'Could not delete pantry item.';
        this.cdr.detectChanges();
        return;
      }

      this.pantryItems = this.pantryItems.filter(
        (currentItem) => currentItem.id !== item.id
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
      this.error = 'Could not update pantry quantity.';
      this.cdr.detectChanges();
      return;
    }

    item.amount = nextAmount;
    this.cdr.detectChanges();
  }

  async deleteItem(item: PantryItem): Promise<void> {
    const confirmed = window.confirm(`Delete "${item.name}"?`);
    if (!confirmed) {
      return;
    }

    const success = await this.pantryService.deletePantryItem(item.id);

    if (!success) {
      this.error = 'Could not delete pantry item.';
      this.cdr.detectChanges();
      return;
    }

    this.pantryItems = this.pantryItems.filter(
      (currentItem) => currentItem.id !== item.id
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

  onUpdatePantry(): void {
    console.log('Update pantry');
  }

  onCleanPantry(): void {
    console.log('Clean pantry');
  }

  setMode(mode: 'all' | 'expiry' | 'recent'): void {
    this.mode = mode;
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
        this.error = 'Could not create pantry item.';
        this.cdr.detectChanges();
        return;
      }

      await this.loadPantryItems();
      this.closePantrySheet();
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
      this.error = 'Could not update pantry item.';
      this.cdr.detectChanges();
      return;
    }

    await this.loadPantryItems();
    this.closePantrySheet();
  }

  async addAlwaysPresentItem(): Promise<void> {
    const trimmedName = this.newAlwaysPresentName.trim();
    if (!trimmedName) {
      return;
    }

    const created = await this.pantryService.addAlwaysPresentItem(trimmedName);

    if (!created) {
      this.error = 'Could not add always present item.';
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
      this.error = 'Could not delete always present item.';
      this.cdr.detectChanges();
      return;
    }

    this.alwaysPresentItems = this.alwaysPresentItems.filter(
      (currentItem) => currentItem.id !== item.id
    );
    this.cdr.detectChanges();
  }

  private showToast(message: string): void {
    this.toastMessage = message;
    this.cdr.detectChanges();

    if (this.toastTimeout) {
      clearTimeout(this.toastTimeout);
    }

    this.toastTimeout = setTimeout(() => {
      this.toastMessage = null;
      this.cdr.detectChanges();
    }, 2500);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}