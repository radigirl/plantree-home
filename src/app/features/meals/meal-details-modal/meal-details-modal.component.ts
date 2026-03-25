import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Meal } from '../../../models/meal.model';
import { CommonModule } from '@angular/common';


@Component({
  selector: 'app-meal-details-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './meal-details-modal.component.html',
  styleUrls: ['./meal-details-modal.component.scss']
})
export class MealDetailsModalComponent {
  @Input() meal: Meal | null = null;
  @Input() isOpen = false;

  @Output() close = new EventEmitter<void>();

  onClose(): void {
    this.close.emit();
  }
}