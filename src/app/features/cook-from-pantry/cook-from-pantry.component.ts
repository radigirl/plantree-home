import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PageLoadingComponent } from '../../shared/components/page-loading/page-loading.component';
import {  PantryService } from '../../services/pantry.service';
import { Meal } from '../../models/meal.model';
import { MealsService } from '../../services/meal.service';
import { UserStateService } from '../../services/user.state.service';
import { PantryItem } from '../../models/pantry-item.model';

@Component({
  selector: 'app-cook-from-pantry',
  standalone: true,
  imports: [CommonModule, FormsModule, PageLoadingComponent],
  templateUrl: './cook-from-pantry.component.html',
  styleUrl: './cook-from-pantry.component.scss',
})
export class CookFromPantryComponent implements OnInit {
  isLoading = false;
  error = '';
  meals: Meal[] = [];
  pantryItems: PantryItem[] = [];
  // showHelperMessage = false;

  

  constructor(
    private pantryService: PantryService,
    private mealsService: MealsService,
    private userStateService: UserStateService,
    private cdr: ChangeDetectorRef
  ) {}

  async ngOnInit(): Promise<void> {
    await this.loadMeals();
    await this.loadPantryItems();
  }

  async loadMeals(): Promise<void> {
    this.isLoading = true;
    try {
      const user = this.userStateService.getCurrentUser();

      if (!user) {
        this.meals = [];
        return;
      }

      this.meals = await this.mealsService.getMeals(user.id);
    } catch (error) {
      console.error('Error loading meals:', error);
      this.error = 'Could not load meals.';
      this.meals = [];
    } finally {
      this.isLoading = false;
      this.cdr.detectChanges();
    }
  }

  async loadPantryItems(): Promise<void> {
    this.isLoading = true;
    this.error = '';

    try {
      this.pantryItems = await this.pantryService.getPantryItems();
    } catch (error) {
      console.error('Error loading pantry items:', error);
      this.error = 'Could not load pantry items.';
    } finally {
      this.isLoading = false;
      this.cdr.detectChanges();
    }
  }



  
}