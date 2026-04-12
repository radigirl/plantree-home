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
import { MemberStateService } from '../../services/member.state.service';
import {
  ResponsiveActionMenuComponent,
  ResponsiveActionMenuItem,
} from '../../shared/components/responsive-action-menu/responsive-action-menu';
import { FeatherModule } from 'angular-feather';
import { PantryService } from '../../services/pantry.service';
import { Subject } from 'rxjs';
import { takeUntil, distinctUntilChanged } from 'rxjs/operators';
import { SpaceStateService } from '../../services/space.state.service';
import { PantryActionDialogComponent } from '../../shared/components/pantry-action-dialog/pantry-action-dialog.component';
import { SnackbarComponent } from '../../shared/components/snackbar/snackbar.component';
import { ConfirmationDialogComponent } from '../../shared/components/confirmation-dialog/confirmation-dialog.component';
import { EditTextDialogComponent } from '../../shared/components/edit-text-dialog/edit-text-dialog.component';
import { classifyPantryMoveItems } from '../../shared/utils/pantry-review.util';


@Component({
  selector: 'app-grocery-lists',
  standalone: true,
  imports: [
    CommonModule,
    PageLoadingComponent,
    FormsModule,
    ResponsiveActionMenuComponent,
    FeatherModule,
    PantryActionDialogComponent,
    SnackbarComponent,
    ConfirmationDialogComponent,
    EditTextDialogComponent,
  ],
  templateUrl: './grocery-lists.component.html',
  styleUrls: ['./grocery-lists.component.scss'],
})
export class GroceryListsComponent implements OnInit, OnDestroy {
  isLoading = true;
  groceryLists: GroceryList[] = [];
  error = '';

  isCreateDialogOpen = false;
  createListName = '';

  openMenuListId: string | null = null;
  selectedListForEdit: GroceryList | null = null;
  editListName = '';

  isPantryDialogOpen = false;
  pantryDialogTitle = '';
  pantryDialogMessage = '';
  pantryDialogShowSkip = false;
  pantryDialogShowArchive = false;
  pendingPantryAction: 'complete' | 'archive' | null = null;
  pendingPantryList: GroceryList | null = null;

  selectedListForActions: GroceryList | null = null;

  listActions: ResponsiveActionMenuItem[] = [];
  showArchived = false;

  pantryCounts: Record<string, number> = {};

  toastMessage = '';
  toastActionLabel: string | null = null;
  private toastTimeout: ReturnType<typeof setTimeout> | null = null;

  isDeleteDialogOpen = false;
  listPendingDelete: GroceryList | null = null;

  undoCompletedList: GroceryList | null = null;
  toastActionType: 'undo-complete' | null = null;

  private listsChannel: RealtimeChannel | null = null;
  private destroy$ = new Subject<void>();

  constructor(
    private groceryService: GroceryService,
    private memberStateService: MemberStateService,
    private spaceStateService: SpaceStateService,
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

  get isEditDialogOpen(): boolean {
    return !!this.selectedListForEdit;
  }

  ngOnInit(): void {
    this.spaceStateService.currentSpace$
      .pipe(
        takeUntil(this.destroy$),
        distinctUntilChanged((prev, curr) => prev?.id === curr?.id)
      )
      .subscribe(async (space) => {
        this.resetListsViewState();

        if (!space) {
          this.groceryLists = [];
          this.pantryCounts = {};
          this.isLoading = false;
          this.listsChannel?.unsubscribe();
          this.cdr.detectChanges();
          return;
        }

        await this.loadGroceryLists();
        this.subscribeToGroceryLists();
      });
  }

  openCreateDialog(): void {
    this.isCreateDialogOpen = true;
    this.createListName = '';
    this.error = '';

    this.openMenuListId = null;
    this.closeEditDialog();
  }

  closeCreateDialog(): void {
    this.isCreateDialogOpen = false;
    this.createListName = '';
  }

  private resetListsViewState(): void {
  this.error = '';

  this.isCreateDialogOpen = false;
  this.createListName = '';

  this.openMenuListId = null;
  this.selectedListForEdit = null;
  this.editListName = '';

  this.selectedListForActions = null;
  this.listActions = [];

  this.showArchived = false;
  this.isDeleteDialogOpen = false;
  this.listPendingDelete = null;
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

  async confirmCreateList(): Promise<void> {
    const trimmedName = this.createListName.trim();

    if (!trimmedName) return;

    const currentMember = this.memberStateService.getCurrentMember();
    const createdByMemberId = currentMember?.id ?? 1;

    const created = await this.groceryService.createGroceryList(
      trimmedName,
      createdByMemberId
    );

    if (!created) {
      this.error = 'Could not create grocery list.';
      this.cdr.detectChanges();
      return;
    }

    this.groceryLists = [created, ...this.groceryLists];

    this.closeCreateDialog();
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
      counts[list.id] = await this.groceryService.getPendingPantryItemsCount(
        list.id
      );
    }

    this.pantryCounts = counts;
  }

  getListActions(list: GroceryList): ResponsiveActionMenuItem[] {
    const actions: ResponsiveActionMenuItem[] = [];

    if (list.status === 'active') {
      actions.push(
        {
          id: 'edit',
          label: 'Edit',
        },
        {
          id: 'complete',
          label: 'Complete list',
        }
      );
    }

    if (list.status === 'completed') {
      actions.push({
        id: 'reuse',
        label: 'Reuse list',
      });

      const pendingPantryItems = this.getPendingPantryItemsCount(list);

      if (pendingPantryItems > 0) {
        actions.push({
          id: 'add-to-pantry',
          label: `Move ${pendingPantryItems} ${pendingPantryItems === 1 ? 'item' : 'items'} to pantry`,
        });
      }

      actions.push({
        id: 'archive',
        label: 'Archive',
      });
    }

    if (list.status === 'archived') {
      actions.push({
        id: 'reuse',
        label: 'Reuse list',
      });
    }

    actions.push({
      id: 'delete',
      label: 'Delete',
    });

    return actions;
  }

  openEditDialog(event: Event, list: GroceryList): void {
  event.stopPropagation();

  this.isCreateDialogOpen = false;
  this.createListName = '';
  this.openMenuListId = null;
  this.selectedListForActions = null;
  this.selectedListForEdit = list;
  this.editListName = list.name;
  this.error = '';
}

  closeEditDialog(): void {
    this.selectedListForEdit = null;
    this.editListName = '';
  }

  async confirmEditList(): Promise<void> {
    const trimmedName = this.editListName.trim();
    const listId = this.selectedListForEdit?.id;

    if (!listId || !trimmedName) {
      return;
    }

    const success = await this.groceryService.updateGroceryListName(
      listId,
      trimmedName
    );

    if (!success) {
      this.error = 'Could not update grocery list.';
      this.cdr.detectChanges();
      return;
    }

    this.groceryLists = this.groceryLists.map((list) =>
      list.id === listId
        ? {
          ...list,
          name: trimmedName,
          updated_at: new Date().toISOString(),
        }
        : list
    );

    this.closeEditDialog();
    this.cdr.detectChanges();
  }

  openDeleteDialog(event: Event, list: GroceryList): void {
    event.stopPropagation();
    this.isDeleteDialogOpen = true;
    this.listPendingDelete = list;
  }

  closeDeleteDialog(): void {
    this.isDeleteDialogOpen = false;
    this.listPendingDelete = null;
  }

  async confirmDeleteList(): Promise<void> {
    const list = this.listPendingDelete;

    if (!list) {
      this.closeDeleteDialog();
      return;
    }

    const success = await this.groceryService.deleteGroceryList(list.id);

    if (!success) {
      this.error = 'Could not delete grocery list.';
      this.closeDeleteDialog();
      this.cdr.detectChanges();
      return;
    }

    this.groceryLists = this.groceryLists.filter(
      (currentList) => currentList.id !== list.id
    );

    if (this.openMenuListId === list.id) {
      this.openMenuListId = null;
    }

    if (this.selectedListForEdit?.id === list.id) {
      this.closeEditDialog();
    }

    this.closeDeleteDialog();
    this.showToast('List deleted');
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
        this.openEditDialog(new Event('click'), list);
        return;

      case 'complete': {
        const pending = this.getPendingPantryItemsCount(list);

        if (pending > 0) {
          this.openPantryDialogForComplete(list);
          return;
        }

        await this.completeList(list, true, true);
        return;
      }

      case 'reuse': {
        this.openMenuListId = null;

        const currentMember = this.memberStateService.getCurrentMember();
        const createdMemberId = currentMember?.id ?? 1;

        const newListName = this.getNextReuseName(list.name);

        const newList = await this.groceryService.createGroceryList(
          newListName,
          createdMemberId
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
            createdMemberId
          );
        }

        await this.loadGroceryLists();
        this.cdr.detectChanges();
        return;
      }

      case 'archive': {
        const pending = this.getPendingPantryItemsCount(list);

        if (pending > 0) {
          this.openPantryDialogForArchive(list);
          return;
        }

        await this.archiveList(list);
        return;
      }

      case 'delete':
        this.openDeleteDialog(new Event('click'), list);
        return;

      case 'add-to-pantry': {
        this.openMenuListId = null;

        const listItems = await this.groceryService.getPendingPantryItems(list.id);
        const pantryItems = await this.pantryService.getPantryItems();

        const reviewResult = classifyPantryMoveItems(listItems, pantryItems);

        console.log('PENDING LIST ITEMS:', listItems);
        console.log('PANTRY ITEMS:', pantryItems);
        console.log('PANTRY REVIEW RESULT:', reviewResult);

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

  openPantryDialogForComplete(list: GroceryList): void {
    const pending = this.getPendingPantryItemsCount(list);

    this.pendingPantryAction = 'complete';
    this.pendingPantryList = list;

    this.pantryDialogTitle = 'Move to pantry?';
    this.pantryDialogMessage = `This list has ${pending} bought ${pending === 1 ? 'item' : 'items'} that can be moved to pantry.`;
    this.pantryDialogShowSkip = true;
    this.pantryDialogShowArchive = false;

    this.isPantryDialogOpen = true;
  }

  openPantryDialogForArchive(list: GroceryList): void {
    const pending = this.getPendingPantryItemsCount(list);

    this.pendingPantryAction = 'archive';
    this.pendingPantryList = list;

    this.pantryDialogTitle = 'Before archiving';
    this.pantryDialogMessage = `This list still has ${pending} ${pending === 1 ? 'item' : 'items'} that can be moved to pantry.`;
    this.pantryDialogShowSkip = false;
    this.pantryDialogShowArchive = true;

    this.isPantryDialogOpen = true;
  }

  closePantryDialog(): void {
    this.isPantryDialogOpen = false;
    this.pantryDialogTitle = '';
    this.pantryDialogMessage = '';
    this.pantryDialogShowSkip = false;
    this.pantryDialogShowArchive = false;
    this.pendingPantryAction = null;
    this.pendingPantryList = null;
  }

  async completeList(
    list: GroceryList,
    showToast: boolean = true,
    allowUndo: boolean = false
  ): Promise<void> {
    const success = await this.groceryService.completeGroceryList(list.id);

    if (!success) {
      this.error = 'Could not complete list.';
      this.cdr.detectChanges();
      return;
    }

    list.status = 'completed';
    list.updated_at = new Date().toISOString();

    if (showToast) {
      if (allowUndo) {
        this.showCompletedUndoToast(list);
      } else {
        this.showToast('List marked as completed');
      }
    }

    this.openMenuListId = null;
    this.cdr.detectChanges();
  }

  async archiveList(
    list: GroceryList,
    showToast: boolean = true
  ): Promise<void> {
    const success = await this.groceryService.updateGroceryListStatus(
      list.id,
      'archived'
    );

    if (!success) {
      this.error = 'Could not archive list.';
      this.cdr.detectChanges();
      return;
    }

    if (showToast) {
      this.showToast('List archived');
    }

    this.openMenuListId = null;
    await this.loadGroceryLists();
    this.cdr.detectChanges();
  }

  async moveItemsToPantry(list: GroceryList): Promise<number> {
    try {
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
      await this.loadPantryCounts();
      this.cdr.detectChanges();
      return itemsToMove.length;
    } catch (error) {
      console.error('Move to pantry failed:', error);
      this.error = 'Could not move items to pantry.';
      this.cdr.detectChanges();
      return 0;
    }
  }

  async onPantryDialogAction(
    action: 'move' | 'skip' | 'archive' | 'cancel'
  ): Promise<void> {
    const list = this.pendingPantryList;
    const pendingAction = this.pendingPantryAction;

    if (!list || !pendingAction) {
      this.closePantryDialog();
      return;
    }

    this.closePantryDialog();

    if (pendingAction === 'complete') {
      if (action === 'move') {
        const movedCount = await this.moveItemsToPantry(list);
        await this.completeList(list, false);

        this.showMovedToPantryAndCompletedToast(movedCount);
      } else if (action === 'skip') {
        await this.completeList(list, true, true);
      }
    }

    if (pendingAction === 'archive') {
      if (action === 'move') {
        const movedCount = await this.moveItemsToPantry(list);
        await this.archiveList(list, false);

        this.showMovedToPantryAndArchivedToast(movedCount);
      } else if (action === 'archive') {
        await this.archiveList(list);
      }
    }
  }

  async undoCompleteList(): Promise<void> {
    const list = this.undoCompletedList;

    if (!list) {
      this.clearToastState();
      this.cdr.detectChanges();
      return;
    }

    const success = await this.groceryService.updateGroceryListStatus(
      list.id,
      'active'
    );

    if (!success) {
      this.error = 'Could not undo completed list.';
      this.clearToastState();
      this.cdr.detectChanges();
      return;
    }

    list.status = 'active';
    list.updated_at = new Date().toISOString();

    this.clearToastState();
    this.cdr.detectChanges();
  }

  showToast(message: string, actionLabel?: string): void {
    this.toastMessage = message;
    this.toastActionLabel = actionLabel ?? null;

    if (!actionLabel) {
      this.toastActionType = null;
      this.undoCompletedList = null;
    }

    if (this.toastTimeout) {
      clearTimeout(this.toastTimeout);
      this.toastTimeout = null;
    }

    this.cdr.detectChanges();

    const duration = actionLabel
      ? 3500
      : message.includes('moved')
        ? 2500
        : 2000;

    this.toastTimeout = setTimeout(() => {
      this.toastMessage = '';
      this.toastActionLabel = null;
      this.toastActionType = null;
      this.undoCompletedList = null;
      this.toastTimeout = null;
      this.cdr.detectChanges();
    }, duration);
  }

  async onToastAction(): Promise<void> {
    if (this.toastActionType === 'undo-complete') {
      await this.undoCompleteList();
      return;
    }

    this.clearToastState();
    this.cdr.detectChanges();
  }

  showMovedToPantryToast(count: number): void {
    this.showToast(
      count === 1
        ? '1 item moved to pantry'
        : `${count} items moved to pantry`
    );
  }

  showMovedToPantryAndCompletedToast(count: number): void {
    this.showToast(
      count === 1
        ? '1 item moved to pantry and list completed'
        : `${count} items moved to pantry and list completed`
    );
  }

  showMovedToPantryAndArchivedToast(count: number): void {
    this.showToast(
      count === 1
        ? '1 item moved to pantry and list archived'
        : `${count} items moved to pantry and list archived`
    );
  }

  clearToastState(): void {
    this.toastMessage = '';
    this.toastActionLabel = null;
    this.toastActionType = null;
    this.undoCompletedList = null;

    if (this.toastTimeout) {
      clearTimeout(this.toastTimeout);
      this.toastTimeout = null;
    }
  }

  showCompletedUndoToast(list: GroceryList): void {
    this.undoCompletedList = list;
    this.toastActionType = 'undo-complete';
    this.showToast('List marked as completed', 'Undo');
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.listsChannel?.unsubscribe();

    if (this.toastTimeout) {
      clearTimeout(this.toastTimeout);
      this.toastTimeout = null;
    }
  }
}