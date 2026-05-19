import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';

@Component({
  selector: 'app-space-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe],
  templateUrl: './space-dialog.component.html',
  styleUrl: './space-dialog.component.scss',
})
export class SpaceDialogComponent implements OnChanges {
  @Input() isOpen = false;
  @Input() mode: 'add' | 'edit' = 'add';
  @Input() initialName = '';
  @Input() spacesCount = 0;

  @Output() closed = new EventEmitter<void>();
  @Output() saved = new EventEmitter<string>();
  @Output() resetSpace = new EventEmitter<void>();
  @Output() deleteSpace = new EventEmitter<void>();

  name = '';
  isResetConfirmOpen = false;
  isDeleteConfirmOpen = false;

  constructor(private cdr: ChangeDetectorRef) { }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isOpen'] || changes['initialName'] || changes['mode']) {
      this.name = this.initialName ?? '';
    }
  }

  close(): void {
    this.closed.emit();
  }

  save(): void {
    const trimmedName = this.name.trim();
    console.log('SPACE DIALOG SAVE CLICKED', trimmedName);
    if (!trimmedName) {
      return;
    }
    this.saved.emit(trimmedName);
  }

  onResetSpace(): void {
    console.log('Reset space clicked from dialog');
    this.resetSpace.emit();
  }

  onDeleteSpace(): void {
    console.log('Delete space clicked from dialog');
    this.deleteSpace.emit();
  }
}