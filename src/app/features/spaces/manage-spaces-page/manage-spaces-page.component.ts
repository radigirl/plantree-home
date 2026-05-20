import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { Observable } from 'rxjs';
import { Check, LucideAngularModule } from 'lucide-angular';

import { Space } from '../../../models/space.model';
import { SpaceStateService } from '../../../services/space.state.service';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { SpaceDialogComponent } from '../space-dialog/space-dialog.component';
import { ConfirmationDialogComponent } from '../../../shared/components/confirmation-dialog/confirmation-dialog.component';
import { SnackbarComponent } from '../../../shared/components/snackbar/snackbar.component';
import { LanguageStateService } from '../../../services/language.state.service';

@Component({
  selector: 'app-manage-spaces-page',
  standalone: true,
  imports: [
    CommonModule,
    TranslatePipe,
    LucideAngularModule,
    SpaceDialogComponent,
    ConfirmationDialogComponent,
    SnackbarComponent
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
  toastMessage = '';
  isToastVisible = false;
  private toastTimeout: ReturnType<typeof setTimeout> | null = null;


  readonly checkIcon = Check;

  constructor(
    private spaceStateService: SpaceStateService,
    private languageStateService: LanguageStateService,
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
    this.selectedSpaceForEdit = space;
    this.spaceConfirmMode = 'delete';
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

  async confirmResetSpace(): Promise<void> {
    const space = this.selectedSpaceForEdit;

    if (!space) {
      return;
    }

    const success = await this.spaceStateService.resetSpace(space.id);

    if (!success) {
      console.error('Could not reset space');
      this.spaceConfirmMode = null;
      return;
    }

    this.spaceConfirmMode = null;
    this.closeSpaceDialog();

    this.showToast(
      this.languageStateService.t('spaces.spaceResetToast')
    );
  }

  async confirmDeleteSpace(): Promise<void> {
    const space = this.selectedSpaceForEdit;

    if (!space) {
      return;
    }

    const result = await this.spaceStateService.deleteSpace(space.id);

    if (!result.success) {
      console.error('Could not delete space');
      this.spaceConfirmMode = null;
      return;
    }

    this.spaceConfirmMode = null;
    this.closeSpaceDialog();

    if (result.switchedToSpace) {
      this.showToast(
        `${this.languageStateService.t('spaces.spaceDeletedToast')} · ${this.languageStateService.t('spaces.switchedTo')} ${result.switchedToSpace.name}`
      );
    } else {
      this.showToast(
        this.languageStateService.t('spaces.spaceDeletedToast')
      );
    }
  }

  showToast(message: string): void {
    this.toastMessage = message;
    this.isToastVisible = true;

    if (this.toastTimeout) {
      clearTimeout(this.toastTimeout);
    }

    this.toastTimeout = setTimeout(() => {
      this.isToastVisible = false;
      this.toastMessage = '';
      this.cdr.detectChanges();
    }, 3000);

    this.cdr.detectChanges();
  }

  getSpaceConfirmMessage(): string {
    const key = this.spaceConfirmMode === 'reset'
      ? 'spaces.resetConfirmMessage'
      : 'spaces.deleteConfirmMessage';

    return this.languageStateService.t(key).replace(/\\n/g, '\n');
  }
}