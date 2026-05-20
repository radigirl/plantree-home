import { Routes } from '@angular/router';
import { HomeComponent } from './features/home/home.component';
import { PlanComponent } from './features/plan/plan.component';
import { PantryComponent } from './features/pantry/pantry.component';
import { GroceryListsComponent } from './features/grocery-lists/grocery-lists.component';
import { DayDetailsComponent } from './features/plan/day-details/day-details.component';
import { GroceryListDetailsComponent } from './features/grocery-lists/grocery-list-details/grocery-list-details.component';
import { MealsComponent } from './features/meals/meals.component';
import { CookFromPantryComponent } from './features/cook-from-pantry/cook-from-pantry.component';
import { WeekStatsComponent } from './features/week-stats/week-stats.component';
import { AboutComponent } from './features/about/about.component';
import { NotificationsComponent } from './features/notifications/notifications.component';
import { ManageSpacesPageComponent } from './features/spaces/manage-spaces-page/manage-spaces-page.component';
import { ManageMembersPageComponent } from './features/members/manage-members-page/manage-members-page.component';
import { ManageIngredientRulesPageComponent } from './features/settings/manage-ingredient-rules-page/manage-ingredient-rules-page.component';

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
  { path: 'week-stats', component: WeekStatsComponent },
  { path: 'about', component: AboutComponent },
  { path: 'notifications', component: NotificationsComponent },
  { path: 'settings/spaces', component: ManageSpacesPageComponent },
  { path: 'settings/members', component: ManageMembersPageComponent },
  { path: 'settings/ingredient-rules', component: ManageIngredientRulesPageComponent }
];