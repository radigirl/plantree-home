import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { Observable } from 'rxjs';
import { Check, LucideAngularModule } from 'lucide-angular';

import { Space } from '../../../models/space.model';
import { SpaceStateService } from '../../../services/space.state.service';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { SpaceDialogComponent } from '../space-dialog/space-dialog.component';
import { ConfirmationDialogComponent } from '../../../shared/components/confirmation-dialog/confirmation-dialog.component';

@Component({
  selector: 'app-manage-spaces-page',
  standalone: true,
  imports: [
    CommonModule,
    TranslatePipe,
    LucideAngularModule,
    SpaceDialogComponent,
    ConfirmationDialogComponent,
  ],
  templateUrl: './manage-spaces-page.component.html',
  styleUrl: './manage-spaces-page.component.scss',
})
export class ManageSpacesPageComponent implements OnInit {
  spaces: Space[] = [];
  currentSpace$: Observable<Space | null>;

  isSpaceDialogOpen = false;
  spaceDialogMode: 'add' | 'edit' = 'add';
  spaceDialogInitialName = '';
  selectedSpaceForEdit: Space | null = null;
  spaceConfirmMode: 'reset' | 'delete' | null = null;

  readonly checkIcon = Check;

  constructor(
    private spaceStateService: SpaceStateService,
    private cdr: ChangeDetectorRef
  ) {
    this.currentSpace$ = this.spaceStateService.currentSpace$;
  }

  async ngOnInit(): Promise<void> {
    await this.spaceStateService.loadSpaces();

    this.spaceStateService.spaces$.subscribe((spaces) => {
      this.spaces = spaces;
      this.cdr.detectChanges();
    });
  }

  onAddSpace(): void {
    this.spaceDialogMode = 'add';
    this.spaceDialogInitialName = '';
    this.selectedSpaceForEdit = null;
    this.isSpaceDialogOpen = true;
  }

  onEditSpace(space: Space): void {
    this.spaceDialogMode = 'edit';
    this.spaceDialogInitialName = space.name;
    this.selectedSpaceForEdit = space;
    this.isSpaceDialogOpen = true;
  }

  onDeleteSpace(space: Space): void {
    console.log('Delete space clicked:', space);
  }

  closeSpaceDialog(): void {
    this.isSpaceDialogOpen = false;
    this.spaceDialogInitialName = '';
    this.selectedSpaceForEdit = null;
  }

  async onSpaceDialogSave(name: string): Promise<void> {
    const mode = this.spaceDialogMode;
    const selectedSpace = this.selectedSpaceForEdit;
    this.closeSpaceDialog();
    if (mode === 'add') {
      await this.spaceStateService.createSpace(name);
      return;
    }
    if (mode === 'edit' && selectedSpace) {
      await this.spaceStateService.updateSpaceName(
        selectedSpace.id,
        name
      );
    }
  }

  onResetSpaceFromDialog(): void {
    this.spaceConfirmMode = 'reset';
  }

  onDeleteSpaceFromDialog(): void {
    this.spaceConfirmMode = 'delete';
  }

  cancelSpaceConfirm(): void {
    this.spaceConfirmMode = null;
  }

  confirmResetSpace(): void {
    console.log('Confirm reset space:', this.selectedSpaceForEdit);

    this.spaceConfirmMode = null;
    this.closeSpaceDialog();
  }

  confirmDeleteSpace(): void {
    console.log('Confirm delete space:', this.selectedSpaceForEdit);

    this.spaceConfirmMode = null;
    this.closeSpaceDialog();
  }
}