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
import { PantryService } from '../../services/pantry.service';

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
  showArchived = false;

  pantryCounts: Record<string, number> = {};

  private listsChannel: RealtimeChannel | null = null;

  constructor(
    private groceryService: GroceryService,
    private userStateService: UserStateService,
    private cdr: ChangeDetectorRef,
    private router: Router,
    private pantryService: PantryService,
  ) { }

  @HostListener('document:click')
  onDocumentClick(): void {
    this.openMenuListId = null;
  }

  get sortedLists(): GroceryList[] {
    return [...this.groceryLists].sort((a, b) => {
      if (a.is_pinned && !b.is_pinned) return -1;
      if (!a.is_pinned && b.is_pinned) return 1;

      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });
  }

  get mainLists(): GroceryList[] {
    return this.sortedLists.filter(
      (list) => list.status === 'active' || list.status === 'completed'
    );
  }

  get archivedLists(): GroceryList[] {
    return this.sortedLists.filter((list) => list.status === 'archived');
  }

  get archivedCount(): number {
    return this.archivedLists.length;
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
      await this.loadPantryCounts();
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
          await this.loadPantryCounts();
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
      this.listActions = this.getListActions(list);
    }
  }

  async loadPantryCounts(): Promise<void> {
    const counts: Record<string, number> = {};

    for (const list of this.groceryLists) {
      const items = await this.groceryService.getItemsByListId(list.id);

      counts[list.id] = items.filter(
        (item: any) => item.status === 'bought' && !item.moved_to_pantry
      ).length;
    }

    this.pantryCounts = counts;
  }

  getListActions(list: GroceryList): ResponsiveActionMenuItem[] {
    const actions: ResponsiveActionMenuItem[] = [];

    // ✅ ONLY allow edit for active lists
    if (list.status === 'active') {
      actions.push({ id: 'edit', label: 'Edit' });
    }

    if (list.status === 'active') {
      actions.push({
        id: 'complete',
        label: 'Complete list',
      });
    }

    if (list.status === 'completed') {
      actions.push(
        {
          id: 'continue',
          label: 'Continue list',
        },
        {
          id: 'reuse',
          label: 'Reuse list',
        }
      );

      const pendingPantryItems = this.getPendingPantryItemsCount(list);

      if (pendingPantryItems > 0) {
        actions.push({
          id: 'add-to-pantry',
          label: `Add ${pendingPantryItems} items to pantry`,
        });
      }

      actions.push({
        id: 'archive',
        label: 'Archive',
      });
    }

    if (list.status === 'archived') {
      actions.push(
        {
          id: 'continue',
          label: 'Continue list',
        },
        {
          id: 'reuse',
          label: 'Reuse list',
        }
      );
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

  onDesktopActionClick(event: Event, actionId: string, list: GroceryList): void {
    void this.handleListAction(actionId, list, event);
  }

  async handleListAction(
    actionId: string,
    list: GroceryList,
    event?: Event
  ): Promise<void> {
    event?.stopPropagation();

    switch (actionId) {
      case 'edit':
        this.startEditList(new Event('click'), list);
        return;

      case 'complete': {
        const success = await this.groceryService.updateGroceryListStatus(
          list.id,
          'completed'
        );

        if (!success) {
          this.error = 'Could not complete list.';
          this.cdr.detectChanges();
          return;
        }

        list.status = 'completed';
        list.updated_at = new Date().toISOString();
        this.openMenuListId = null;
        this.cdr.detectChanges();
        return;
      }

      case 'continue': {
        const success = await this.groceryService.updateGroceryListStatus(
          list.id,
          'active'
        );

        if (!success) {
          this.error = 'Could not continue list.';
          this.cdr.detectChanges();
          return;
        }

        list.status = 'active';
        list.updated_at = new Date().toISOString();
        this.openMenuListId = null;
        this.cdr.detectChanges();
        return;
      }

      case 'reuse': {
        this.openMenuListId = null;

        const currentUser = this.userStateService.getCurrentUser();
        const createdByUserId = currentUser?.id ?? 1;

        const newListName = this.getNextReuseName(list.name);

        const newList = await this.groceryService.createGroceryList(
          newListName,
          createdByUserId
        );

        if (!newList) {
          this.error = 'Could not reuse list.';
          this.cdr.detectChanges();
          return;
        }

        const sourceItems = await this.groceryService.getItemsByListId(list.id);

        for (const item of sourceItems) {
          await this.groceryService.createGroceryItem(
            newList.id,
            item.name,
            createdByUserId
          );
        }

        await this.loadGroceryLists();
        this.cdr.detectChanges();
        return;
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

        this.openMenuListId = null;
        await this.loadGroceryLists();
        this.cdr.detectChanges();
        return;
      }

      case 'delete':
        await this.deleteList(new Event('click'), list);
        return;

      case 'add-to-pantry': {
        this.openMenuListId = null;

        const items = await this.groceryService.getItemsByListId(list.id);

        const itemsToMove = items.filter(
          (item: any) => item.status === 'bought' && !item.moved_to_pantry
        );

        for (const item of itemsToMove) {
          await this.pantryService.addOrIncrementPantryItem(item.name);

          await this.groceryService.updateGroceryItemMovedToPantry(
            item.id,
            true
          );
        }

        // refresh pantry counts after update
        await this.loadPantryCounts();

        console.log(`Moved ${itemsToMove.length} items to pantry`);

        this.cdr.detectChanges();
        return;
      }
    }
  }

  async onActionSelected(actionId: string): Promise<void> {
    if (!this.selectedListForActions) return;

    const list = this.selectedListForActions;
    this.closeActions();
    await this.handleListAction(actionId, list);
  }

  getPendingPantryItemsCount(list: GroceryList): number {
    return this.pantryCounts[list.id] ?? 0;
  }

  private getReuseBaseName(name: string): string {
    return name.replace(/\s*\(copy(?:\s+\d+)?\)$/i, '').trim();
  }

  private getNextReuseName(sourceName: string): string {
    const baseName = this.getReuseBaseName(sourceName);

    const matchingNames = this.groceryLists
      .map((list) => list.name)
      .filter((name) => this.getReuseBaseName(name) === baseName);

    const hasPlainCopy = matchingNames.includes(`${baseName} (copy)`);

    let maxCopyNumber = hasPlainCopy ? 1 : 0;

    for (const name of matchingNames) {
      const match = name.match(/\(copy\s+(\d+)\)$/i);
      if (match) {
        maxCopyNumber = Math.max(maxCopyNumber, Number(match[1]));
      }
    }

    return maxCopyNumber === 0
      ? `${baseName} (copy)`
      : `${baseName} (copy ${maxCopyNumber + 1})`;
  }

}