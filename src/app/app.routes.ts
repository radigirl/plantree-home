import { Routes } from '@angular/router';
import { HomeComponent } from './features/home/home.component';
import { PlanComponent } from './features/plan/plan.component';
import { PantryComponent } from './features/pantry/pantry.component';
import { GroceryListsComponent } from './features/grocery-lists/grocery-lists.component';
import { DayDetailsComponent } from './features/plan/day-details/day-details.component';
import { GroceryListDetailsComponent } from './features/grocery-lists/grocery-list-details/grocery-list-details.component';
import { MealsComponent } from './features/meals/meals.component';
import { CookFromPantryComponent } from './features/cook-from-pantry/cook-from-pantry.component';

export const routes: Routes = [
  { path: '', redirectTo: 'home', pathMatch: 'full' },

  { path: 'home', component: HomeComponent },
  { path: 'plan', component: PlanComponent },
  { path: 'plan/day/:date', component: DayDetailsComponent },
  { path: 'pantry', component: PantryComponent },
  { path: 'cook-from-pantry', component: CookFromPantryComponent },
  { path: 'grocery-lists', component: GroceryListsComponent },
  { path: 'grocery-lists/:id', component: GroceryListDetailsComponent },
  { path: 'meals', component: MealsComponent },
];