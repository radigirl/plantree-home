import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { FeatherModule } from 'angular-feather';
import { PageLoadingComponent } from '../../shared/components/page-loading/page-loading.component';
import {  PantryService } from '../../services/pantry.service';
import { PantryItem } from '../../models/pantry-item.model';

@Component({
  selector: 'app-pantry',
  standalone: true,
  imports: [CommonModule, FormsModule, PageLoadingComponent, FeatherModule],
  templateUrl: './pantry.component.html',
  styleUrl: './pantry.component.scss',
})
export class PantryComponent implements OnInit {
  isLoading = true;
  error = '';
  newItemName = '';

  pantryItems: PantryItem[] = [];

  editingItemId: string | null = null;
  editItemName = '';
  editItemAmount = 1;

  constructor(
    private pantryService: PantryService,
    private cdr: ChangeDetectorRef
  ) {}

  async ngOnInit(): Promise<void> {
    await this.loadPantryItems();
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

  async addItem(): Promise<void> {
  const trimmedName = this.newItemName.trim();
  if (!trimmedName || this.editingItemId) {
    return;
  }
  this.error = '';
  const saved = await this.pantryService.addOrIncrementPantryItem(trimmedName);
  if (!saved) {
    this.error = 'Could not add pantry item.';
    this.cdr.detectChanges();
    return;
  }
  this.newItemName = '';
  this.pantryItems = await this.pantryService.getPantryItems();
  this.cdr.detectChanges();
}

  startEditItem(item: PantryItem): void {
    this.editingItemId = item.id;
    this.editItemName = item.name;
    this.editItemAmount = item.amount;
  }

  cancelEditItem(): void {
    this.editingItemId = null;
    this.editItemName = '';
    this.editItemAmount = 1;
  }

  async saveEditedItem(): Promise<void> {
    const trimmedName = this.editItemName.trim();
    const normalizedAmount = this.normalizeAmount(this.editItemAmount);

    if (!this.editingItemId || !trimmedName) {
      return;
    }

    const nameSuccess = await this.pantryService.updatePantryItemName(
      this.editingItemId,
      trimmedName
    );

    if (!nameSuccess) {
      this.error = 'Could not update pantry item.';
      this.cdr.detectChanges();
      return;
    }

    const amountSuccess = await this.pantryService.updatePantryItemAmount(
      this.editingItemId,
      normalizedAmount
    );

    if (!amountSuccess) {
      this.error = 'Could not update pantry quantity.';
      this.cdr.detectChanges();
      return;
    }

    this.cancelEditItem();
    this.pantryItems = await this.pantryService.getPantryItems();
    this.cdr.detectChanges();
  }

  async deleteItem(item: PantryItem): Promise<void> {
    if (this.editingItemId && this.editingItemId !== item.id) {
      return;
    }

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

    if (this.editingItemId === item.id) {
      this.cancelEditItem();
    }

    this.cdr.detectChanges();
  }

  private normalizeAmount(value: number): number {
    if (!Number.isFinite(value) || value < 1) {
      return 1;
    }

    return Math.floor(value);
  }
}