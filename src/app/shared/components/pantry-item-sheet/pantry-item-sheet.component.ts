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
import { CalendarDays, LucideAngularModule } from 'lucide-angular';

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
  imports: [CommonModule, FormsModule, LucideAngularModule],
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
  type: 'countable' | 'loose' = 'countable';
  sizeAmount: number | null = null;
  sizeUnit = '';
  expiryDate: string | null = null;
  errorMessage = '';
  hasTriedSave = false;
  nameErrorMessage = '';

  readonly calendarIcon = CalendarDays;

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
    return ['g', 'kg', 'ml', 'l'];
  }

  get sizePlaceholder(): string {
  if (!this.sizeUnit) {
    return '—'; // neutral state
  }

  if (this.sizeUnit === 'g' || this.sizeUnit === 'ml') {
    return 'e.g. 500';
  }

  return 'e.g. 1';
}

  onTypeChange(): void {
  if (this.type === 'loose' && !this.sizeUnit) {
    this.sizeUnit = '';
  }

  this.updateSizeUnitError();
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

  updateSizeUnitError(): void {
    if (!this.hasTriedSave) {
      this.errorMessage = '';
      return;
    }

    const hasSize =
      this.sizeAmount !== null &&
      this.sizeAmount !== undefined &&
      this.sizeAmount !== 0;

    const hasUnit = !!this.sizeUnit?.trim();

    if (this.type === 'loose') {
      if (!hasSize && !hasUnit) {
        this.errorMessage = 'Please select a unit and enter a size';
        return;
      }
      if (!hasUnit) {
        this.errorMessage = 'Please select a unit';
        return;
      }
      if (!hasSize) {
        this.errorMessage = 'Please enter a size';
        return;
      }
      this.errorMessage = '';
      return;
    }
    if (hasSize && !hasUnit) {
      this.errorMessage = 'Please select a unit';
      return;
    }
    if (!hasSize && hasUnit) {
      this.errorMessage = 'Please enter a size';
      return;
    }
    this.errorMessage = '';
  }

  updateNameError(): void {
    if (!this.hasTriedSave) {
      this.nameErrorMessage = '';
      return;
    }
    this.nameErrorMessage = this.name.trim() ? '' : 'Please enter a name';
  }

  save(): void {
    this.hasTriedSave = true;

    this.updateNameError();
    this.updateSizeUnitError();

    if (this.nameErrorMessage || this.errorMessage) {
      return;
    }

    const trimmedName = this.name.trim();

    if (!Number.isFinite(this.amount) || this.amount < 1) {
      return;
    }

    const hasSize =
      this.sizeAmount !== null &&
      this.sizeAmount !== undefined &&
      this.sizeAmount !== 0;

    const hasUnit = !!this.sizeUnit?.trim();

    this.saved.emit({
      name: trimmedName,
      amount: Math.floor(this.amount),
      unit: this.type === 'loose' ? 'loose' : 'item',
      size_amount: hasSize ? this.sizeAmount : null,
      size_unit: hasUnit ? this.sizeUnit.trim() : null,
      expiry_date: this.expiryDate || null,
    });
  }

  private patchFormFromInputs(): void {
    if (!this.isOpen) {
      return;
    }

    this.hasTriedSave = false;
    this.errorMessage = '';
    this.nameErrorMessage = '';

    if (this.mode === 'edit' && this.item) {
      this.name = this.item.name ?? '';
      this.amount = this.item.amount ?? 1;
      this.type = this.item.unit === 'loose' ? 'loose' : 'countable';
      this.sizeAmount = this.item.size_amount ?? null;
      this.sizeUnit = this.item.size_unit ?? '';
      this.expiryDate = this.toDateInputValue(this.item.expiry_date);

      return;
    }

    this.name = '';
    this.amount = 1;
    this.type = 'countable';
    this.sizeAmount = null;
    this.sizeUnit = '';
    this.expiryDate = '';
    this.hasTriedSave = false;
    this.errorMessage = '';
    this.nameErrorMessage = '';
  }

  private toDateInputValue(value?: string | null): string {
    if (!value) return '';
    return value.slice(0, 10);
  }

  openDatePicker() {
    console.log('Opening date picker');
  }
}