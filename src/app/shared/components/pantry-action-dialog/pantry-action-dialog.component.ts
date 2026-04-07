import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';

export type PantryDialogAction = 'move' | 'skip' | 'archive' | 'cancel';

@Component({
  selector: 'app-pantry-action-dialog',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './pantry-action-dialog.component.html',
  styleUrls: ['./pantry-action-dialog.component.scss'],
})
export class PantryActionDialogComponent {
  @Input() title: string = '';
  @Input() message: string = '';
  @Input() showSkip: boolean = false;
  @Input() showArchive: boolean = false;

  @Output() action = new EventEmitter<PantryDialogAction>();

  onMove(): void {
    this.action.emit('move');
  }

  onSkip(): void {
    this.action.emit('skip');
  }

  onArchive(): void {
    this.action.emit('archive');
  }

  onCancel(): void {
    this.action.emit('cancel');
  }
}