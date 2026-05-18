import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';

import { TranslatePipe } from '../../shared/pipes/translate.pipe';

@Component({
  selector: 'app-notifications',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  templateUrl: './notifications.component.html',
  styleUrl: './notifications.component.scss',
})
export class NotificationsComponent {}