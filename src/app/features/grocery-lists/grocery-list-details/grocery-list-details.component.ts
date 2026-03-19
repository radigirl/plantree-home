import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { PageLoadingComponent } from '../../../shared/components/page-loading/page-loading.component';
import { GroceryService } from '../../../services/grocery.service';
import { GroceryList } from '../../../models/grocery-list.model';
import { UserStateService } from '../../../services/user.state.service';

@Component({
  selector: 'app-grocery-list-details',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, PageLoadingComponent],
  templateUrl: './grocery-list-details.component.html',
  styleUrls: ['./grocery-list-details.component.scss'],
})
export class GroceryListDetailsComponent implements OnInit {
  isLoading = true;
  groceryList: GroceryList | null = null;
  groceryItems: any[] = [];
  error = '';
  newItemName = '';

  constructor(
    private route: ActivatedRoute,
    private groceryService: GroceryService,
    private userStateService: UserStateService,
    private cdr: ChangeDetectorRef
  ) { }

  async ngOnInit(): Promise<void> {
    const listId = this.route.snapshot.paramMap.get('id');

    if (!listId) {
      this.error = 'Missing grocery list id.';
      this.isLoading = false;
      this.cdr.detectChanges();
      return;
    }

    await this.loadGroceryList(listId);
  }

  async loadGroceryList(listId: string): Promise<void> {
    this.isLoading = true;
    this.error = '';

    try {
      this.groceryList = await this.groceryService.getGroceryListById(listId);

      if (!this.groceryList) {
        this.error = 'Grocery list not found.';
        return;
      }

      this.groceryItems = await this.groceryService.getItemsByListId(listId);
    } catch (error) {
      console.error('Error loading grocery list:', error);
      this.error = 'Could not load grocery list.';
    } finally {
      this.isLoading = false;
      this.cdr.detectChanges();
    }
  }

  async addItem(): Promise<void> {
    const trimmedName = this.newItemName.trim();

    if (!trimmedName || !this.groceryList) {
      return;
    }

    const currentUser = this.userStateService.getCurrentUser();
    const addedByUserId = currentUser?.id ?? 1;

    const created = await this.groceryService.createGroceryItem(
      this.groceryList.id,
      trimmedName,
      addedByUserId
    );

    if (!created) {
      this.error = 'Could not add grocery item.';
      this.cdr.detectChanges();
      return;
    }

    this.newItemName = '';
    this.groceryItems = await this.groceryService.getItemsByListId(this.groceryList.id);
    this.cdr.detectChanges();
  }

  async toggleItem(item: any): Promise<void> {
    const nextStatus = item.status === 'bought' ? 'needed' : 'bought';

    const currentUser = this.userStateService.getCurrentUser();
    const boughtByUserId = currentUser?.id ?? 1;

    const updated = await this.groceryService.updateGroceryItemStatus(
      item.id,
      nextStatus,
      boughtByUserId
    );

    if (!updated || !this.groceryList) {
      return;
    }

    this.groceryItems = await this.groceryService.getItemsByListId(this.groceryList.id);
    this.cdr.detectChanges();
  }

  getUserLabel(user?: { id?: number; name?: string }): string {
    const currentUser = this.userStateService.getCurrentUser();

    if (!user) {
      return 'Someone';
    }

    if (currentUser?.id === user.id) {
      return 'You';
    }

    return user.name || 'Someone';
  }

  getItemMetaParts(item: any) {
    const currentUser = this.userStateService.getCurrentUser();

    const isAddedByYou = currentUser?.id === item.addedBy?.id;
    const isBoughtByYou = currentUser?.id === item.boughtBy?.id;

    return {
      addedByName: item.addedBy?.name || 'Someone',
      boughtByName: item.boughtBy?.name || 'Someone',
      isAddedByYou,
      isBoughtByYou,
      isBought: item.status === 'bought',
    };
  }
}