import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Space } from '../../../models/space.model';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { Pencil, Trash2, Check, LucideAngularModule } from 'lucide-angular';

@Component({
  selector: 'app-manage-spaces-dialog',
  standalone: true,
  imports: [CommonModule, TranslatePipe, LucideAngularModule],
  templateUrl: './manage-spaces-dialog.component.html',
  styleUrl: './manage-spaces-dialog.component.scss',
})
export class ManageSpacesDialogComponent {
  @Input() isOpen = false;
  @Input() spaces: Space[] = [];
  @Input() currentSpaceId: string | null = null;
  @Input() isSpaceDialogOpen = false;


  @Output() closed = new EventEmitter<void>();
  @Output() addSpace = new EventEmitter<void>();
  @Output() editSpace = new EventEmitter<Space>();
  @Output() deleteSpace = new EventEmitter<Space>();

  readonly editIcon = Pencil;
  readonly deleteIcon = Trash2;
  readonly checkIcon = Check;

  close(): void {
    this.closed.emit();
  }

  onEditSpace(space: Space, event: MouseEvent): void {
    event.stopPropagation();
    this.editSpace.emit(space);
  }

  onDeleteSpace(space: Space, event: MouseEvent): void {
    event.stopPropagation();
    this.deleteSpace.emit(space);
  }
}