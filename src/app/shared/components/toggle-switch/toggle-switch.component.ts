import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-toggle-switch',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './toggle-switch.component.html',
  styleUrls: ['./toggle-switch.component.scss'],
})
export class ToggleSwitchComponent {
  @Input() options: { label: string; value: string }[] = [];
  @Input() value: string = '';

  @Output() valueChange = new EventEmitter<string>();

  select(option: string) {
    this.valueChange.emit(option);
  }
}