import { CommonModule } from '@angular/common';
import {
  ChangeDetectorRef,
  Component,
  HostListener,
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
import {
  ResponsiveActionMenuComponent,
  ResponsiveActionMenuItem,
} from '../../shared/components/responsive-action-menu/responsive-action-menu';
import { FeatherModule } from 'angular-feather';


@Component({
  selector: 'app-grocery-lists',
  standalone: true,
  imports: [
    CommonModule,
    PageLoadingComponent,
    FormsModule,
    ResponsiveActionMenuComponent,
     FeatherModule,
  ],
  templateUrl: './grocery-lists.component.html',
  styleUrls: ['./grocery-lists.component.scss'],
})
export class GroceryListsComponent implements OnInit, OnDestroy {
  isLoading = true;
  groceryLists: GroceryList[] = [];
  error = '';

  isCreatingList = false;
  newListName = '';

  openMenuListId: string | null = null;
  editingListId: string | null = null;
  editListName = '';

  selectedListForActions: GroceryList | null = null;

  listActions: ResponsiveActionMenuItem[] = [];

  private listsChannel: RealtimeChannel | null = null;
  

  constructor(
    private groceryService: GroceryService,
    private userStateService: UserStateService,
    private cdr: ChangeDetectorRef,
    private router: Router
  ) { }

  @HostListener('document:click')
  onDocumentClick(): void {
    this.openMenuListId = null;
  }

  get sortedLists(): GroceryList[] {
    return [...this.groceryLists].sort((a, b) => {
      if (a.is_pinned && !b.is_pinned) return -1;
      if (!a.is_pinned && b.is_pinned) return 1;

      return (
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      );
    });
  }

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

    this.openMenuListId = null;
    this.editingListId = null;
    this.editListName = '';
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

    this.groceryLists = [created, ...this.groceryLists];
    this.cdr.detectChanges();
  }

  toggleActionsMenu(event: Event, list: GroceryList): void {
    event.stopPropagation();

    const isSame = this.openMenuListId === list.id;

    this.openMenuListId = isSame ? null : list.id;
    this.selectedListForActions = isSame ? null : list;

    if (!isSame) {
      this.listActions = this.buildListActions(list);
    }
  }

  buildListActions(list: GroceryList): ResponsiveActionMenuItem[] {
    const actions: ResponsiveActionMenuItem[] = [
      { id: 'edit', label: 'Edit' },
    ];

    if (list.status === 'active') {
      actions.push({
        id: 'complete',
        label: 'Complete list',
      });
    }

    if (list.status === 'completed') {
      actions.push(
        {
          id: 'complete',
          label: 'Reopen list',
        },
        {
          id: 'archive',
          label: 'Archive',
        }
      );
    }

    if (list.status === 'archived') {
      actions.push({
        id: 'complete',
        label: 'Reopen list',
      });
    }

    actions.push({
      id: 'delete',
      label: 'Delete',
    });

    return actions;
  }

  startEditList(event: Event, list: GroceryList): void {
    event.stopPropagation();

    this.isCreatingList = false;
    this.newListName = '';
    this.editingListId = list.id;
    this.editListName = list.name;
    this.openMenuListId = null;
    this.error = '';
  }

  async saveEditedList(): Promise<void> {
    const trimmedName = this.editListName.trim();

    if (!this.editingListId || !trimmedName) {
      return;
    }

    const success = await this.groceryService.updateGroceryListName(
      this.editingListId,
      trimmedName
    );

    if (!success) {
      this.error = 'Could not update grocery list.';
      this.cdr.detectChanges();
      return;
    }

    this.groceryLists = this.groceryLists.map((list) =>
      list.id === this.editingListId
        ? {
          ...list,
          name: trimmedName,
          updated_at: new Date().toISOString(),
        }
        : list
    );

    this.editingListId = null;
    this.editListName = '';
    this.cdr.detectChanges();
  }

  cancelEditList(): void {
    this.editingListId = null;
    this.editListName = '';
  }

  async deleteList(event: Event, list: GroceryList): Promise<void> {
    event.stopPropagation();

    const confirmed = window.confirm(`Delete "${list.name}"?`);
    if (!confirmed) {
      return;
    }

    const success = await this.groceryService.deleteGroceryList(list.id);

    if (!success) {
      this.error = 'Could not delete grocery list.';
      this.cdr.detectChanges();
      return;
    }

    this.groceryLists = this.groceryLists.filter(
      (currentList) => currentList.id !== list.id
    );

    if (this.openMenuListId === list.id) {
      this.openMenuListId = null;
    }

    if (this.editingListId === list.id) {
      this.editingListId = null;
      this.editListName = '';
    }

    this.cdr.detectChanges();
  }

  openList(list: GroceryList): void {
    this.router.navigate(['/grocery-lists', list.id]);
  }

  isMobileViewport(): boolean {
    return window.innerWidth < 1024;
  }

  closeActions(): void {
    this.openMenuListId = null;
    this.selectedListForActions = null;
  }

  async onTogglePin(list: GroceryList): Promise<void> {
    const nextValue = !list.is_pinned;

    const success = await this.groceryService.updateGroceryListPinned(
      list.id,
      nextValue
    );

    if (!success) {
      this.error = 'Could not update pinned state.';
      this.cdr.detectChanges();
      return;
    }

    list.is_pinned = nextValue;
    list.updated_at = new Date().toISOString();
    this.cdr.detectChanges();
  }


  async onMenuPin(event: Event, list: GroceryList): Promise<void> {
    event.stopPropagation();

    const nextValue = !list.is_pinned;

    const success = await this.groceryService.updateGroceryListPinned(
      list.id,
      nextValue
    );

    if (!success) {
      this.error = 'Could not update pinned state.';
      this.cdr.detectChanges();
      return;
    }

    list.is_pinned = nextValue;
    list.updated_at = new Date().toISOString();
    this.openMenuListId = null;
    this.cdr.detectChanges();
  }


  async onMenuComplete(event: Event, list: GroceryList): Promise<void> {
    event.stopPropagation();

    const nextStatus =
      list.status === 'completed' ? 'active' : 'completed';

    const success = await this.groceryService.updateGroceryListStatus(
      list.id,
      nextStatus
    );

    if (!success) {
      this.error = 'Could not update list status.';
      this.cdr.detectChanges();
      return;
    }

    list.status = nextStatus;
    list.updated_at = new Date().toISOString();
    this.openMenuListId = null;
    this.cdr.detectChanges();
  }

  async onMenuArchive(event: Event, list: GroceryList): Promise<void> {
    event.stopPropagation();

    const success = await this.groceryService.updateGroceryListStatus(
      list.id,
      'archived'
    );

    if (!success) {
      this.error = 'Could not archive list.';
      this.cdr.detectChanges();
      return;
    }

    list.status = 'archived';
    list.updated_at = new Date().toISOString();
    this.openMenuListId = null;
    this.cdr.detectChanges();
  }

 async onActionSelected(actionId: string): Promise<void> {
  if (!this.selectedListForActions) return;

  const list = this.selectedListForActions;
  this.closeActions();

  switch (actionId) {
    case 'edit':
      this.startEditList(new Event('click'), list);
      break;
    case 'complete': {
      const nextStatus =
        list.status === 'completed' || list.status === 'archived'
          ? 'active'
          : 'completed';

      const success = await this.groceryService.updateGroceryListStatus(
        list.id,
        nextStatus
      );

      if (!success) {
        this.error = 'Could not update list status.';
        this.cdr.detectChanges();
        return;
      }

      list.status = nextStatus;
      list.updated_at = new Date().toISOString();
      break;
    }

    case 'archive': {
      const success = await this.groceryService.updateGroceryListStatus(
        list.id,
        'archived'
      );

      if (!success) {
        this.error = 'Could not archive list.';
        this.cdr.detectChanges();
        return;
      }

      list.status = 'archived';
      list.updated_at = new Date().toISOString();
      break;
    }

    case 'delete':
      await this.deleteList(new Event('click'), list);
      return;
  }

  this.cdr.detectChanges();
}

}