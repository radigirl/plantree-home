import { Component } from '@angular/core';
import {
  LucideAngularModule,
  House,
  CalendarDays,
  Package
} from 'lucide-angular';

@Component({
  selector: 'app-navigation',
  standalone: true,
  imports: [LucideAngularModule],
  templateUrl: './navigation.component.html',
  styleUrl: './navigation.component.scss'
})
export class NavigationComponent {
  readonly homeIcon = House;
  readonly planIcon = CalendarDays;
  readonly pantryIcon = Package;
}