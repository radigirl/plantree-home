import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '../../pipes/translate.pipe';

export type PantryMoveType = 'countable' | 'measured';

export interface PantryMoveReviewRow {
  id: string;
  sourceName: string;
  selected: boolean;
  moveAs: PantryMoveType;
  amount: number | null;
  unit: string | null;
  pantryName: string;
  sizeAmount: number | null;
  sizeUnit: string | null;
  reviewMode: 'measured' | 'countable' | 'simple';
  measuredAmount: number | null;
  measuredUnit: string | null;
  countAmount: number | null;
}

@Component({
  selector: 'app-pantry-move-review-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe],
  templateUrl: './pantry-move-review-dialog.component.html',
  styleUrls: ['./pantry-move-review-dialog.component.scss'],
})
export class PantryMoveReviewDialogComponent {
  @Input() isOpen = false;
  @Input() rows: PantryMoveReviewRow[] = [];

  @Output() closed = new EventEmitter<void>();
  @Output() confirmed = new EventEmitter<PantryMoveReviewRow[]>();

  expandedRowId: string | null = null;

  invalidRowId: string | null = null;

  toggleRow(row: PantryMoveReviewRow): void {
    if (
      this.expandedRowId &&
      this.expandedRowId !== row.id
    ) {
      const currentRow = this.rows.find((item) => item.id === this.expandedRowId);

      if (currentRow && !this.isPackageValid(currentRow)) {
        this.invalidRowId = currentRow.id;
        return;
      }
    }

    this.invalidRowId = null;
    this.expandedRowId = this.expandedRowId === row.id ? null : row.id;
  }

  isRowExpanded(row: PantryMoveReviewRow): boolean {
    return this.expandedRowId === row.id;
  }

  getPreviewText(row: PantryMoveReviewRow): string {
    const name = row.pantryName?.trim() || row.sourceName;
    if (row.reviewMode === 'simple') {
      return name;
    }
    if (row.reviewMode === 'measured') {
      if (row.measuredAmount === null || row.measuredAmount === undefined) {
        return name;
      }
      return `${row.measuredAmount} ${row.measuredUnit || ''} ${name}`.trim();
    }
    // countable
    if (row.countAmount === null || row.countAmount === undefined) {
      return name;
    }
    if (row.sizeAmount && row.sizeUnit) {
      return `${row.countAmount} × ${row.sizeAmount} ${row.sizeUnit} ${name}`;
    }
    return `${row.countAmount} ${name}`;
  }

  getRowMode(row: PantryMoveReviewRow): 'measured' | 'countable' | 'simple' {
    return row.reviewMode;
  }

  isPackageValid(row: PantryMoveReviewRow): boolean {
    if (this.getRowMode(row) !== 'countable') {
      return true;
    }
    const hasSize =
      row.sizeAmount !== null &&
      row.sizeAmount !== undefined &&
      String(row.sizeAmount).trim() !== '';
    const hasUnit = !!row.sizeUnit;
    return hasSize === hasUnit;
  }

  shouldShowPackageValidation(row: PantryMoveReviewRow): boolean {
    return this.invalidRowId === row.id && !this.isPackageValid(row);
  }

  setRowMode(row: PantryMoveReviewRow, mode: 'measured' | 'countable' | 'simple'): void {
    row.reviewMode = mode;

    if (mode === 'measured') {
      row.moveAs = 'measured';
      row.amount = row.measuredAmount;
      row.unit = row.measuredUnit || 'g';
      return;
    }

    if (mode === 'countable') {
      row.moveAs = 'countable';
      row.amount = row.countAmount;
      row.unit = null;
      return;
    }

    row.moveAs = 'countable';
    row.amount = null;
    row.unit = null;
  }

  onClose(): void {
    this.closed.emit();
  }

  onConfirm(): void {
    const selectedRows = this.rows.filter((row) => row.selected);

    console.log('PANTRY MOVE REVIEW - selected rows:', selectedRows);

    this.confirmed.emit(selectedRows);
  }

  get selectedCount(): number {
    return this.rows.filter((row) => row.selected).length;
  }
}