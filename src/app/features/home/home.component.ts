import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { DashboardCardComponent } from '../../shared/components/dashboard-card/dashboard-card.component';

type TodayCardState = 'empty' | 'single-not-ready' | 'single-ready' | 'multiple';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, DashboardCardComponent],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
})
export class HomeComponent {
  todayState: TodayCardState = 'multiple';

//  TO DO: remove these mocks when real data

  // todayState: TodayCardState = 'empty';
  // todayState: TodayCardState = 'single-not-ready';
  // todayState: TodayCardState = 'single-ready';
  // todayState: TodayCardState = 'multiple';

  todayMeal = {
    name: 'Pasta',
    cook: 'Dad',
    status: 'Not ready yet',
  };

  additionalMealsCount = 2;

  openToday(): void {
    console.log('Open Today screen');
  }

  openWeekPlan(): void {
    console.log('Open Week Plan');
  }

  openGroceryLists(): void {
    console.log('Open Grocery Lists');
  }

  openWeekStats(): void {
    console.log('Open Week Stats');
  }
}