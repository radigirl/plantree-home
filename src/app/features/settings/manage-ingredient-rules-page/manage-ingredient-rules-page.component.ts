import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { SpaceStateService } from '../../../services/space.state.service';
import {
  IngredientRulesService,
  IngredientWordRule,
  MeasurementRuleRow,
} from '../../../services/ingredient-rules.service';
import {
  IngredientRuleDialogComponent,
  IngredientRuleDialogSaveValue,
  IngredientRuleDialogType,
  IngredientRuleDialogMode,
} from '../ingredient-rule-dialog/ingredient-rule-dialog.component';
import { ConfirmationDialogComponent } from '../../../shared/components/confirmation-dialog/confirmation-dialog.component';
import { SnackbarComponent } from '../../../shared/components/snackbar/snackbar.component';
import { LanguageStateService } from '../../../services/language.state.service';

@Component({
  selector: 'app-manage-ingredient-rules-page',
  standalone: true,
  imports: [
    CommonModule,
    TranslatePipe,
    IngredientRuleDialogComponent,
    ConfirmationDialogComponent,
    SnackbarComponent,
  ],
  templateUrl: './manage-ingredient-rules-page.component.html',
  styleUrls: ['./manage-ingredient-rules-page.component.scss'],
})
export class ManageIngredientRulesPageComponent implements OnInit {

  wordRules: IngredientWordRule[] = [];
  measurementRules: MeasurementRuleRow[] = [];

  isLoading = true;
  error = '';

  isWordRulesExpanded = false;
  isMeasurementRulesExpanded = false;

  isRuleDialogOpen = false;
  ruleDialogMode: IngredientRuleDialogMode = 'add';
  ruleDialogType: IngredientRuleDialogType = 'word';

  selectedWordRule: IngredientWordRule | null = null;
  selectedMeasurementRule: MeasurementRuleRow | null = null;

  wordRulePendingDelete: IngredientWordRule | null = null;
  measurementRulePendingDelete: MeasurementRuleRow | null = null;

  toastMessage = '';
  isToastVisible = false;
  private toastTimeout: ReturnType<typeof setTimeout> | null = null;

  pendingRuleSave: IngredientRuleDialogSaveValue | null = null;
  conflictingWordRule: IngredientWordRule | null = null;
  conflictingMeasurementRule: MeasurementRuleRow | null = null;

  ruleConfirm: {
    action: 'delete' | 'override';
    type: 'word' | 'measurement';
  } | null = null;

  constructor(
    private spaceStateService: SpaceStateService,
    private ingredientRulesService: IngredientRulesService,
    private languageStateService: LanguageStateService,
    private cdr: ChangeDetectorRef
  ) { }

  async ngOnInit(): Promise<void> {
    this.spaceStateService.currentSpace$.subscribe(async (space) => {
      if (!space?.id) {
        return;
      }

      await this.loadRules();
    });

    await this.spaceStateService.loadSpaces();
  }

  async loadRules(): Promise<void> {
    this.isLoading = true;
    this.error = '';
    const spaceId = this.spaceStateService.getCurrentSpace()?.id;
    if (!spaceId) {
      this.isLoading = false;
      this.error = 'No current space selected';
      this.cdr.detectChanges();
      return;
    }
    try {
      const [wordRules, measurementRules] = await Promise.all([
        this.ingredientRulesService.getWordRules(spaceId),
        this.ingredientRulesService.getMeasurementRules(spaceId),
      ]);
      this.wordRules = [...wordRules];
      this.measurementRules = [...measurementRules];
    } catch (error) {
      console.error('Error loading ingredient rules:', error);
      this.error = 'Could not load ingredient rules';
    } finally {
      this.isLoading = false;
      this.cdr.detectChanges();
    }
  }

  toggleWordRules(): void {
    this.isWordRulesExpanded = !this.isWordRulesExpanded;
  }

  toggleMeasurementRules(): void {
    this.isMeasurementRulesExpanded = !this.isMeasurementRulesExpanded;
  }

  onAddWordRule(): void {
    this.ruleDialogMode = 'add';
    this.ruleDialogType = 'word';
    this.selectedWordRule = null;
    this.selectedMeasurementRule = null;
    this.isRuleDialogOpen = true;
  }

  onEditWordRule(rule: IngredientWordRule): void {
    this.ruleDialogMode = 'edit';
    this.ruleDialogType = 'word';
    this.selectedWordRule = rule;
    this.selectedMeasurementRule = null;
    this.isRuleDialogOpen = true;
  }

  onAddMeasurementRule(): void {
    this.ruleDialogMode = 'add';
    this.ruleDialogType = 'measurement';
    this.selectedWordRule = null;
    this.selectedMeasurementRule = null;
    this.isRuleDialogOpen = true;
  }

  onEditMeasurementRule(rule: MeasurementRuleRow): void {
    this.ruleDialogMode = 'edit';
    this.ruleDialogType = 'measurement';
    this.selectedMeasurementRule = rule;
    this.selectedWordRule = null;
    this.isRuleDialogOpen = true;
  }

  closeRuleDialog(): void {
    this.isRuleDialogOpen = false;
    this.selectedWordRule = null;
    this.selectedMeasurementRule = null;
  }

  async onRuleDialogSave(value: IngredientRuleDialogSaveValue): Promise<void> {
    if (value.type === 'word') {
      const conflict = this.findWordRuleConflict(value);

      if (conflict) {
        this.pendingRuleSave = value;
        this.conflictingWordRule = conflict;
        this.conflictingMeasurementRule = null;
        this.wordRulePendingDelete = null;
        this.measurementRulePendingDelete = null;
        this.ruleConfirm = {
          action: 'override',
          type: value.type,
        };
        return;
      }
    }

    if (value.type === 'measurement') {
      const conflict = this.findMeasurementRuleConflict(value);

      if (conflict) {
        this.pendingRuleSave = value;
        this.conflictingMeasurementRule = conflict;
        this.conflictingWordRule = null;
        this.wordRulePendingDelete = null;
        this.measurementRulePendingDelete = null;
        this.ruleConfirm = {
          action: 'override',
          type: value.type,
        };
        return;
      }
    }

    await this.saveRule(value);
  }

  private async saveRule(value: IngredientRuleDialogSaveValue): Promise<void> {
    const spaceId = this.spaceStateService.getCurrentSpace()?.id;
    if (!spaceId) return;

    if (value.type === 'word' && value.wordRule) {
      const success = await this.ingredientRulesService.saveWordRules([
        {
          spaceId,
          singularText: value.wordRule.singularText,
          pluralText: value.wordRule.pluralText,
        },
      ]);

      if (!success) return;

      this.closeRuleDialog();
      await this.loadRules();
      this.showToast(this.languageStateService.t('ingredientRulesPage.ruleSaved'));
      return;
    }

    if (value.type === 'measurement' && value.measurementRule) {
      await this.ingredientRulesService.saveMeasurementRule({
        spaceId,
        ingredientName: value.measurementRule.ingredientName,
        measurementStyle: value.measurementRule.measurementStyle,
        convertedAmount: value.measurementRule.convertedAmount!,
        convertedUnit: value.measurementRule.convertedUnit,
      });

      this.closeRuleDialog();
      await this.loadRules();
      this.showToast(this.languageStateService.t('ingredientRulesPage.ruleSaved'));
    }
  }

  async confirmRuleAction(): Promise<void> {
    if (this.ruleConfirm?.action === 'override') {
      await this.confirmOverrideRule();
      return;
    }

    await this.confirmDeleteRule();
  }

  private async confirmOverrideRule(): Promise<void> {
    const value = this.pendingRuleSave;

    if (!value) {
      return;
    }

    this.ruleConfirm = null;

    if (value.type === 'word') {
      if (this.conflictingWordRule?.id) {
        await this.ingredientRulesService.deleteWordRule(
          this.conflictingWordRule.id
        );
      }

      if (
        this.selectedWordRule?.id &&
        this.selectedWordRule.id !== this.conflictingWordRule?.id
      ) {
        await this.ingredientRulesService.deleteWordRule(
          this.selectedWordRule.id
        );
      }
    }

    if (value.type === 'measurement') {
      if (this.conflictingMeasurementRule?.id) {
        await this.ingredientRulesService.deleteMeasurementRule(
          this.conflictingMeasurementRule.id
        );
      }

      if (
        this.selectedMeasurementRule?.id &&
        this.selectedMeasurementRule.id !== this.conflictingMeasurementRule?.id
      ) {
        await this.ingredientRulesService.deleteMeasurementRule(
          this.selectedMeasurementRule.id
        );
      }
    }

    await this.saveRule(value);

    this.pendingRuleSave = null;
    this.conflictingWordRule = null;
    this.conflictingMeasurementRule = null;

    this.showToast(
      this.languageStateService.t('ingredientRulesPage.ruleUpdated')
    );
  }

  onDeleteWordRule(rule: IngredientWordRule, event: Event): void {
    event.stopPropagation();
    this.wordRulePendingDelete = rule;
    this.measurementRulePendingDelete = null;
    this.ruleConfirm = {
      action: 'delete',
      type: 'word',
    };
  }

  onDeleteMeasurementRule(rule: MeasurementRuleRow, event: Event): void {
    event.stopPropagation();
    this.measurementRulePendingDelete = rule;
    this.wordRulePendingDelete = null;
    this.ruleConfirm = {
      action: 'delete',
      type: 'measurement',
    };
  }

  onRuleDialogDelete(): void {
    if (this.ruleDialogType === 'word' && this.selectedWordRule) {
      this.wordRulePendingDelete = this.selectedWordRule;
      this.ruleConfirm = {
        action: 'delete',
        type: 'word',
      };
      return;
    }
    if (this.ruleDialogType === 'measurement' && this.selectedMeasurementRule) {
      this.measurementRulePendingDelete = this.selectedMeasurementRule;
      this.ruleConfirm = {
        action: 'delete',
        type: 'measurement',
      };
    }
  }

  formatMeasurementRule(rule: MeasurementRuleRow): string {
    return `1 ${rule.measurement_style} = ${rule.converted_amount} ${rule.converted_unit}`;
  }

  cancelRuleConfirm(): void {
    this.ruleConfirm = null;
    this.pendingRuleSave = null;
    this.wordRulePendingDelete = null;
    this.measurementRulePendingDelete = null;
    this.conflictingWordRule = null;
    this.conflictingMeasurementRule = null;
  }

  async confirmDeleteRule(): Promise<void> {
    let success = false;
    if (
      this.ruleConfirm?.type === 'word' &&
      this.wordRulePendingDelete?.id
    ) {
      success = await this.ingredientRulesService.deleteWordRule(
        this.wordRulePendingDelete.id
      );
    }
    if (
      this.ruleConfirm?.type === 'measurement' &&
      this.measurementRulePendingDelete?.id
    ) {
      success = await this.ingredientRulesService.deleteMeasurementRule(
        this.measurementRulePendingDelete.id
      );
    }
    if (!success) {
      return;
    }
    this.cancelRuleConfirm();
    this.closeRuleDialog();
    await this.loadRules();
    this.showToast(
      this.languageStateService.t('ingredientRulesPage.ruleDeleted')
    );
  }

  private normalizeRuleText(value: string): string {
    return value.trim().toLowerCase();
  }

  private findWordRuleConflict(value: IngredientRuleDialogSaveValue): IngredientWordRule | null {
    const singularText = value.wordRule?.singularText;
    if (!singularText) return null;

    return this.wordRules.find((rule) =>
      this.normalizeRuleText(rule.singular_text) === this.normalizeRuleText(singularText) &&
      rule.id !== this.selectedWordRule?.id
    ) ?? null;
  }

  private findMeasurementRuleConflict(value: IngredientRuleDialogSaveValue): MeasurementRuleRow | null {
    const rule = value.measurementRule;
    if (!rule) return null;

    return this.measurementRules.find((existing) =>
      this.normalizeRuleText(existing.ingredient_name) === this.normalizeRuleText(rule.ingredientName) &&
      existing.measurement_style === rule.measurementStyle &&
      existing.id !== this.selectedMeasurementRule?.id
    ) ?? null;
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
    }, 2500);
    this.cdr.detectChanges();
  }

}