import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';

import { TranslatePipe } from '../../shared/pipes/translate.pipe';

@Component({
  selector: 'app-about',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  templateUrl: './about.component.html',
  styleUrl: './about.component.scss',
})
export class AboutComponent {}