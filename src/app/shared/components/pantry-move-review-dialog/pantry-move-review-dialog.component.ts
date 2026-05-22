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