import { CommonModule } from '@angular/common';
import {
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { RealtimeChannel } from '@supabase/supabase-js';
import { GroceryService } from '../../services/grocery.service';
import { GroceryList } from '../../models/grocery-list.model';
import { PageLoadingComponent } from '../../shared/components/page-loading/page-loading.component';
import { UserStateService } from '../../services/user.state.service';

@Component({
  selector: 'app-grocery-lists',
  standalone: true,
  imports: [CommonModule, PageLoadingComponent, FormsModule],
  templateUrl: './grocery-lists.component.html',
  styleUrls: ['./grocery-lists.component.scss'],
})
export class GroceryListsComponent implements OnInit, OnDestroy {
  isLoading = true;
  groceryLists: GroceryList[] = [];
  error = '';

  isCreatingList = false;
  newListName = '';

  private listsChannel: RealtimeChannel | null = null;

  constructor(
    private groceryService: GroceryService,
    private userStateService: UserStateService,
    private cdr: ChangeDetectorRef,
    private router: Router
  ) {}

  async ngOnInit(): Promise<void> {
    await this.loadGroceryLists();
    this.subscribeToGroceryLists();
  }

  ngOnDestroy(): void {
    this.listsChannel?.unsubscribe();
  }

  async loadGroceryLists(): Promise<void> {
    this.isLoading = true;
    this.error = '';

    try {
      this.groceryLists = await this.groceryService.getGroceryLists();
      console.log('GROCERY LISTS:', this.groceryLists);
    } catch (error) {
      console.error('Error loading grocery lists:', error);
      this.error = 'Could not load grocery lists.';
    } finally {
      this.isLoading = false;
      this.cdr.detectChanges();
    }
  }

  subscribeToGroceryLists(): void {
    this.listsChannel?.unsubscribe();

    this.listsChannel = this.groceryService.supabase
      .channel('grocery-lists')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'grocery_lists',
        },
        async () => {
          this.groceryLists = await this.groceryService.getGroceryLists();
          this.cdr.detectChanges();
        }
      )
      .subscribe();
  }

  startCreateList(): void {
    this.isCreatingList = true;
    this.newListName = '';
    this.error = '';
  }

  cancelCreateList(): void {
    this.isCreatingList = false;
    this.newListName = '';
  }

  async saveNewList(): Promise<void> {
    const trimmedName = this.newListName.trim();

    if (!trimmedName) {
      return;
    }

    const currentUser = this.userStateService.getCurrentUser();
    const createdByUserId = currentUser?.id ?? 1;

    const created = await this.groceryService.createGroceryList(
      trimmedName,
      createdByUserId
    );

    if (!created) {
      this.error = 'Could not create grocery list.';
      this.cdr.detectChanges();
      return;
    }

    this.isCreatingList = false;
    this.newListName = '';

    this.groceryLists = await this.groceryService.getGroceryLists();
    this.cdr.detectChanges();
  }

  openList(list: GroceryList): void {
    this.router.navigate(['/grocery-lists', list.id]);
  }
}