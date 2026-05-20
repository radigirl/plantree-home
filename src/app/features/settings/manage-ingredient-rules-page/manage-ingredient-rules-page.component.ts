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

@Component({
  selector: 'app-manage-ingredient-rules-page',
  standalone: true,
  imports: [CommonModule, TranslatePipe, IngredientRuleDialogComponent],
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

  constructor(
    private spaceStateService: SpaceStateService,
    private ingredientRulesService: IngredientRulesService,
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

  onRuleDialogSave(value: IngredientRuleDialogSaveValue): void {
    console.log('Rule dialog saved:', value);
    this.closeRuleDialog();
  }

  onRuleDialogDelete(): void {
    console.log('Rule dialog delete:', {
      type: this.ruleDialogType,
      wordRule: this.selectedWordRule,
      measurementRule: this.selectedMeasurementRule,
    });

    this.closeRuleDialog();
  }

  onDeleteWordRule(rule: IngredientWordRule, event: Event): void {
    event.stopPropagation();
    console.log('Delete word rule:', rule);
  }

  onDeleteMeasurementRule(rule: MeasurementRuleRow, event: Event): void {
    event.stopPropagation();
    console.log('Delete measurement rule:', rule);
  }

  formatMeasurementRule(rule: MeasurementRuleRow): string {
    return `1 ${rule.measurement_style} = ${rule.converted_amount} ${rule.converted_unit}`;
  }

}