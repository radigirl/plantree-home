import { CommonModule } from '@angular/common';
import {
  ChangeDetectorRef,
  Component,
  HostListener,
  OnDestroy,
  OnInit,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { RealtimeChannel } from '@supabase/supabase-js';
import { PageLoadingComponent } from '../../../shared/components/page-loading/page-loading.component';
import { GroceryService } from '../../../services/grocery.service';
import { GroceryList } from '../../../models/grocery-list.model';
import { UserStateService } from '../../../services/user.state.service';
import { ResponsiveActionMenuComponent, ResponsiveActionMenuItem } from '../../../shared/components/responsive-action-menu/responsive-action-menu';

@Component({
  selector: 'app-grocery-list-details',
  standalone: true,
  imports: [CommonModule, FormsModule, PageLoadingComponent, ResponsiveActionMenuComponent],
  templateUrl: './grocery-list-details.component.html',
  styleUrls: ['./grocery-list-details.component.scss'],
})
export class GroceryListDetailsComponent implements OnInit, OnDestroy {
  isLoading = true;
  groceryList: GroceryList | null = null;
  groceryItems: any[] = [];
  error = '';
  newItemName = '';

  openItemMenuId: string | null = null;
  editingItemId: string | null = null;
  editItemName = '';

  selectedItemForActions: any | null = null;
  itemActions: ResponsiveActionMenuItem[] = [
    { id: 'edit', label: 'Edit' },
    { id: 'delete', label: 'Delete' },
  ];


  private itemsChannel: RealtimeChannel | null = null;

  constructor(
    private route: ActivatedRoute,
    private groceryService: GroceryService,
    private userStateService: UserStateService,
    private cdr: ChangeDetectorRef
  ) { }

  @HostListener('document:click')
  onDocumentClick(): void {
    this.openItemMenuId = null;
  }

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

  ngOnDestroy(): void {
    this.itemsChannel?.unsubscribe();
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
      this.subscribeToGroceryItems(listId);
    } catch (error) {
      console.error('Error loading grocery list:', error);
      this.error = 'Could not load grocery list.';
    } finally {
      this.isLoading = false;
      this.cdr.detectChanges();
    }
  }

  subscribeToGroceryItems(listId: string): void {
    this.itemsChannel?.unsubscribe();

    this.itemsChannel = this.groceryService.supabase
      .channel(`grocery-list-items-${listId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'grocery_list_items',
          filter: `grocery_list_id=eq.${listId}`,
        },
        async () => {
          if (!this.groceryList) {
            return;
          }

          this.groceryItems = await this.groceryService.getItemsByListId(listId);
          this.cdr.detectChanges();
        }
      )
      .subscribe();
  }

  async addItem(): Promise<void> {
    if (this.isReadOnly) return;
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
    this.groceryItems = await this.groceryService.getItemsByListId(
      this.groceryList.id
    );
    this.cdr.detectChanges();
  }

 async toggleItem(item: any): Promise<void> {
  if (this.isReadOnly || this.editingItemId === item.id) {
    return;
  }

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

  if (nextStatus === 'needed') {
    const resetSuccess = await this.groceryService.updateGroceryItemMovedToPantry(
      item.id,
      false
    );

    if (!resetSuccess) {
      this.error = 'Could not reset pantry state.';
      this.cdr.detectChanges();
      return;
    }
  }

  this.groceryItems = await this.groceryService.getItemsByListId(
    this.groceryList.id
  );
  this.cdr.detectChanges();
}

  toggleItemMenu(event: Event, item: any): void {
  event.stopPropagation();

  if (this.isReadOnly) {
    return;
  }

  if (this.isMobileViewport()) {
    this.selectedItemForActions = item;
  } else {
    this.openItemMenuId = this.openItemMenuId === item.id ? null : item.id;
  }
}

  startEditItem(event: Event, item: any): void {
    if (this.isReadOnly) return;
    event.stopPropagation();
    this.openItemMenuId = null;
    this.editingItemId = item.id;
    this.editItemName = item.name;
  }

  async saveEditedItem(): Promise<void> {
    const trimmedName = this.editItemName.trim();

    if (!this.editingItemId || !trimmedName) {
      return;
    }

    const success = await this.groceryService.updateGroceryItemName(
      this.editingItemId,
      trimmedName
    );

    if (!success) {
      this.error = 'Could not update grocery item.';
      this.cdr.detectChanges();
      return;
    }

    this.groceryItems = this.groceryItems.map((item) =>
      item.id === this.editingItemId ? { ...item, name: trimmedName } : item
    );

    this.editingItemId = null;
    this.editItemName = '';
    this.cdr.detectChanges();
  }

  cancelEditItem(): void {
    this.editingItemId = null;
    this.editItemName = '';
  }

  async deleteItem(event: Event, item: any): Promise<void> {
    if (this.isReadOnly) return;
    event.stopPropagation();

    const confirmed = window.confirm(`Delete "${item.name}"?`);
    if (!confirmed) {
      return;
    }

    const success = await this.groceryService.deleteGroceryItem(item.id);

    if (!success) {
      this.error = 'Could not delete grocery item.';
      this.cdr.detectChanges();
      return;
    }

    this.groceryItems = this.groceryItems.filter(
      (currentItem) => currentItem.id !== item.id
    );

    this.openItemMenuId = null;

    if (this.editingItemId === item.id) {
      this.editingItemId = null;
      this.editItemName = '';
    }

    this.cdr.detectChanges();
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

  goBack(): void {
    window.history.back();
  }

  isMobileViewport(): boolean {
    return window.innerWidth < 1024;
  }

  async onItemActionSelected(actionId: string): Promise<void> {
    const item = this.selectedItemForActions;
    if (!item) return;

    this.selectedItemForActions = null;

    switch (actionId) {
      case 'edit':
        this.startEditItem(new Event('click'), item);
        break;

      case 'delete':
        await this.deleteItem(new Event('click'), item);
        break;
    }
  }

  get isReadOnly(): boolean {
    return (
      this.groceryList?.status === 'completed' ||
      this.groceryList?.status === 'archived'
    );
  }

  async continueList(): Promise<void> {
  if (!this.groceryList) {
    return;
  }

  const success = await this.groceryService.updateGroceryListStatus(
    this.groceryList.id,
    'active'
  );

  if (!success) {
    this.error = 'Could not continue list.';
    this.cdr.detectChanges();
    return;
  }

  this.groceryList = {
    ...this.groceryList,
    status: 'active',
  };

  this.cdr.detectChanges();
}

}