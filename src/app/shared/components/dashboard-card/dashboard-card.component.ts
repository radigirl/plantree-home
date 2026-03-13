import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-dashboard-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard-card.component.html',
  styleUrls: ['./dashboard-card.component.scss'],
})
export class DashboardCardComponent {
  @Input() title = '';
  @Input() clickable = true;
  @Input() featured = false;

  @Output() cardClick = new EventEmitter<void>();

  onCardClick(): void {
    if (this.clickable) {
      this.cardClick.emit();
    }
  }
}