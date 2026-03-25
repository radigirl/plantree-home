import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';

export interface ResponsiveActionMenuItem {
  id: string;
  label: string;
}

@Component({
  selector: 'app-responsive-action-menu',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './responsive-action-menu.html',
  styleUrls: ['./responsive-action-menu.scss'],
})
export class ResponsiveActionMenuComponent {
  private readonly DESKTOP_BREAKPOINT = 1024;

  @Input() isOpen = false;
  @Input() title = '';
  @Input() subtitle = '';
  @Input() image = '';
  @Input() actions: ResponsiveActionMenuItem[] = [];

  @Output() closed = new EventEmitter<void>();
  @Output() actionSelected = new EventEmitter<string>();

  get isDesktop(): boolean {
    return window.innerWidth >= this.DESKTOP_BREAKPOINT;
  }

  onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.close();
    }
  }

  onActionClick(actionId: string): void {
    this.actionSelected.emit(actionId);
  }

  close(): void {
    this.closed.emit();
  }
}