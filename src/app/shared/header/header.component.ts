import { Component } from '@angular/core';
import { LucideAngularModule, User } from 'lucide-angular';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [LucideAngularModule],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss'
})
export class HeaderComponent {
  readonly userIcon = User;
}