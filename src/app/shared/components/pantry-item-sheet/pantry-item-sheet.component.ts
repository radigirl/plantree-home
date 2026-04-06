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
  unit = 'item';
  sizeAmount: number | null = null;
  sizeUnit = '';
  expiryDate: string | null = null;

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
    if (!this.item?.created_at) {
      return '';
    }

    return new Date(this.item.created_at).toLocaleDateString();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isOpen'] || changes['mode'] || changes['item']) {
      this.patchFormFromInputs();
    }
  }

  onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.close();
    }
  }

  close(): void {
    this.closed.emit();
  }

  save(): void {
    const trimmedName = this.name.trim();

    if (!trimmedName) {
      return;
    }

    if (!Number.isFinite(this.amount) || this.amount < 1) {
      return;
    }

    const safeUnit = this.unit?.trim() || 'item';

    this.saved.emit({
      name: trimmedName,
      amount: Math.floor(this.amount),
      unit: safeUnit,
      size_amount:
        this.sizeAmount === null ||
          this.sizeAmount === undefined ||
          this.sizeAmount === 0
          ? null
          : this.sizeAmount,
      size_unit: this.sizeUnit?.trim() || null,
      expiry_date: this.expiryDate || null,
    });
  }

  private patchFormFromInputs(): void {
  if (!this.isOpen) {
    return;
  }

  if (this.mode === 'edit' && this.item) {
    this.name = this.item.name ?? '';
    this.amount = this.item.amount ?? 1;
    this.unit = this.item.unit ?? 'item';
    this.sizeAmount = this.item.size_amount ?? null;
    this.sizeUnit = this.item.size_unit ?? '';
    this.expiryDate = this.toDateInputValue(this.item.expiry_date);
    return;
  }

  this.name = '';
  this.amount = 1;
  this.unit = 'item';
  this.sizeAmount = null;
  this.sizeUnit = '';
  this.expiryDate = '';
}

  private toDateInputValue(value?: string | null): string {
    if (!value) {
      return '';
    }

    return value.slice(0, 10);
  }
}