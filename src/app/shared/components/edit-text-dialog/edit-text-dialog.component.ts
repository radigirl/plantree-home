import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-edit-text-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './edit-text-dialog.component.html',
  styleUrl: './edit-text-dialog.component.scss',
})
export class EditTextDialogComponent {
  @Input() title = 'Edit';
  @Input() subtitle = '';
  @Input() label = 'Name';
  @Input() value = '';
  @Input() placeholder = 'Enter value';

  @Input() confirmLabel = 'Save';
  @Input() cancelLabel = 'Cancel';

  @Output() cancel = new EventEmitter<void>();
  @Output() confirm = new EventEmitter<void>();
  @Output() valueChange = new EventEmitter<string>();

  onCancel(): void {
    this.cancel.emit();
  }

  onConfirm(): void {
    this.confirm.emit();
  }

  onValueChange(nextValue: string): void {
    this.valueChange.emit(nextValue);
  }
}