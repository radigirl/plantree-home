import { CommonModule } from '@angular/common';
import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PantryItem } from '../../../models/pantry-item.model';

export interface PantryItemSheetValue {
  name: string;
  amount: number;
  unit: string;
  size_amount: number | null;
  size_unit: string | null;
  expiry_date: string | null;
}

@Component({
  selector: 'app-pantry-item-sheet',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './pantry-item-sheet.component.html',
  styleUrls: ['./pantry-item-sheet.component.scss'],
})
export class PantryItemSheetComponent implements OnChanges {
  private readonly DESKTOP_BREAKPOINT = 1024;

  @Input() isOpen = false;
  @Input() mode: 'add' | 'edit' = 'add';
  @Input() item: PantryItem | null = null;

  @Output() closed = new EventEmitter<void>();
  @Output() saved = new EventEmitter<PantryItemSheetValue>();

  name = '';
  amount = 1;

  // UI fields
  type = '__none';
  sizeUnit = '';
  sizeAmount: number | null = null;
  expiryDate: string | null = null;

  errorMessage = '';

  get isDesktop(): boolean {
    return window.innerWidth >= this.DESKTOP_BREAKPOINT;
  }

  get title(): string {
    return this.mode === 'add' ? 'Add pantry item' : 'Edit pantry item';
  }

  get submitLabel(): string {
    return this.mode === 'add' ? 'Add' : 'Save';
  }

  get createdAtLabel(): string {
    if (!this.item?.created_at) return '';
    return new Date(this.item.created_at).toLocaleDateString();
  }

  get unitOptions(): string[] {
    if (this.type === 'bottle') return ['ml', 'l', 'g', 'kg'];
    if (this.type === 'pack') return ['g', 'kg', 'ml', 'l'];
    return ['g', 'kg', 'ml', 'l'];
  }

  get sizePlaceholder(): string {
    if (!this.sizeUnit) return 'e.g. 1';
    if (this.sizeUnit === 'g' || this.sizeUnit === 'ml') return 'e.g. 500';
    return 'e.g. 1';
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isOpen'] || changes['mode'] || changes['item']) {
      this.patchFormFromInputs();
    }
  }

  close(): void {
    this.closed.emit();
  }

  onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.close();
    }
  }

  save(): void {
    const trimmedName = this.name.trim();

    if (!trimmedName) return;
    if (!Number.isFinite(this.amount) || this.amount < 1) return;

    const hasSize = this.sizeAmount !== null && this.sizeAmount !== 0;
    const hasUnit = !!this.sizeUnit;

    if (hasSize && !hasUnit) {
      this.errorMessage = 'Please select a unit';
      return;
    }

    if (!hasSize && hasUnit) {
      this.errorMessage = 'Please enter a size';
      return;
    }

    this.errorMessage = '';

    this.saved.emit({
      name: trimmedName,
      amount: Math.floor(this.amount),
      unit: this.type === '__none' ? 'item' : this.type,
      size_amount: hasSize ? this.sizeAmount : null,
      size_unit: this.sizeUnit || null,
      expiry_date: this.expiryDate || null,
    });
  }

  private patchFormFromInputs(): void {
    if (!this.isOpen) return;

    this.errorMessage = '';

    if (this.mode === 'edit' && this.item) {
      this.name = this.item.name ?? '';
      this.amount = this.item.amount ?? 1;
      this.type = this.item.unit === 'item'
        ? '__none'
        : (this.item.unit ?? '__none');

      this.sizeUnit = this.item.size_unit ?? '';
      this.sizeAmount = this.item.size_amount ?? null;
      this.expiryDate = this.toDateInputValue(this.item.expiry_date);

      return;
    }

    this.name = '';
    this.amount = 1;
    this.type = '__none';
    this.sizeAmount = null;
    this.sizeUnit = '';
    this.expiryDate = '';
  }

  private toDateInputValue(value?: string | null): string {
    if (!value) return '';
    return value.slice(0, 10);
  }
}