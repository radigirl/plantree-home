import { Component } from '@angular/core';
import { Router } from '@angular/router';
import {
  LucideAngularModule,
  House,
  CalendarDays,
  Package,
  ShoppingCart
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
  readonly groceryListsIcon = ShoppingCart;

  constructor(private router: Router) {}

  goTo(route: string): void {
    this.router.navigate([route]);
  }

}