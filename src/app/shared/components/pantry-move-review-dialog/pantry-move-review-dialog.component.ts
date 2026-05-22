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

  toggleRow(row: PantryMoveReviewRow): void {
    this.expandedRowId = this.expandedRowId === row.id ? null : row.id;
  }

  isRowExpanded(row: PantryMoveReviewRow): boolean {
    return this.expandedRowId === row.id;
  }

  getPreviewText(row: PantryMoveReviewRow): string {
    const name = row.pantryName?.trim() || row.sourceName;

    if (row.amount === null || row.amount === undefined) {
      return name;
    }

    if (row.moveAs === 'measured' && row.unit) {
      return `${row.amount} ${row.unit} ${name}`;
    }

    return `${row.amount} ${name}`;
  }

  getRowMode(row: PantryMoveReviewRow): 'measured' | 'countable' | 'simple' {
    if (row.moveAs === 'measured') {
      return 'measured';
    }

    return row.amount == null ? 'simple' : 'countable';
  }

  onClose(): void {
    this.closed.emit();
  }

  onConfirm(): void {
    const selectedRows = this.rows.filter((row) => row.selected);
    console.log('PANTRY MOVE REVIEW CONFIRMED', selectedRows);
    this.confirmed.emit(selectedRows);
  }

  get selectedCount(): number {
    return this.rows.filter((row) => row.selected).length;
  }
}