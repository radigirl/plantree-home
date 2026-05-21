import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { LanguageStateService } from '../../../services/language.state.service';

export type IngredientRuleDialogType = 'word' | 'measurement';
export type IngredientRuleDialogMode = 'add' | 'edit';

export interface IngredientRuleDialogSaveValue {
  type: IngredientRuleDialogType;
  wordRule?: {
    singularText: string;
    pluralText: string;
  };
  measurementRule?: {
    ingredientName: string;
    measurementStyle: string;
    convertedAmount: number | null;
    convertedUnit: string;
  };
}

@Component({
  selector: 'app-ingredient-rule-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe],
  templateUrl: './ingredient-rule-dialog.component.html',
  styleUrls: ['./ingredient-rule-dialog.component.scss'],
})
export class IngredientRuleDialogComponent implements OnChanges {
  @Input() isOpen = false;
  @Input() mode: IngredientRuleDialogMode = 'add';
  @Input() type: IngredientRuleDialogType = 'word';

  @Input() initialSingularText = '';
  @Input() initialPluralText = '';

  @Input() initialIngredientName = '';
  @Input() initialMeasurementStyle = 'cup';
  @Input() initialConvertedAmount: number | null = null;
  @Input() initialConvertedUnit = 'g';

  @Output() closed = new EventEmitter<void>();
  @Output() saved = new EventEmitter<IngredientRuleDialogSaveValue>();
  @Output() deleteRule = new EventEmitter<void>();

  singularText = '';
  pluralText = '';

  ingredientName = '';
  measurementStyle = 'cup';
  convertedAmount: number | null = null;
  convertedUnit = 'g';

  measurementStyleOptions = [
    { value: 'cup', labelKey: 'ingredientRulesPage.measurementCup' },
    { value: 'tbsp', labelKey: 'ingredientRulesPage.measurementTbsp' },
    { value: 'tsp', labelKey: 'ingredientRulesPage.measurementTsp' },
  ];

  convertedUnitOptions = [
    { value: 'g', labelKey: 'ingredientRulesPage.unitGram' },
    { value: 'ml', labelKey: 'ingredientRulesPage.unitMilliliter' },
  ];

  constructor(private languageStateService: LanguageStateService) { }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isOpen'] || changes['type'] || changes['mode']) {
      this.singularText = this.initialSingularText ?? '';
      this.pluralText = this.initialPluralText ?? '';

      this.ingredientName = this.initialIngredientName ?? '';
      this.measurementStyle = this.initialMeasurementStyle ?? 'cup';
      this.convertedAmount = this.initialConvertedAmount ?? null;
      this.convertedUnit = this.initialConvertedUnit ?? 'g';
    }
  }

  close(): void {
    this.closed.emit();
  }

  save(): void {
    if (this.type === 'word') {
      const singularText = this.singularText.trim();
      const pluralText = this.pluralText.trim();
      if (!singularText || !pluralText) {
        return;
      }
      console.log('Save word rule dialog:', { singularText, pluralText });
      this.saved.emit({
        type: 'word',
        wordRule: {
          singularText,
          pluralText,
        },
      });
      return;
    }

    const ingredientName = this.ingredientName.trim();
    if (!ingredientName || !this.convertedAmount || !this.convertedUnit) {
      return;
    }

    console.log('Save measurement rule dialog:', {
      ingredientName,
      measurementStyle: this.measurementStyle,
      convertedAmount: this.convertedAmount,
      convertedUnit: this.convertedUnit,
    });

    this.saved.emit({
      type: 'measurement',
      measurementRule: {
        ingredientName,
        measurementStyle: this.measurementStyle,
        convertedAmount: this.convertedAmount,
        convertedUnit: this.convertedUnit,
      },
    });
  }

  onDelete(): void {
    console.log('Delete ingredient rule from dialog');
    this.deleteRule.emit();
  }
  get measurementExampleHint(): string {
    return this.getExampleForSource(this.getMeasurementSourceLabel(), {
      g: this.getDefaultValueForStyle('g'),
      ml: this.getDefaultValueForStyle('ml'),
    });
  }

  private getDefaultValueForStyle(unit: 'g' | 'ml'): string {
    if (this.measurementStyle === 'cup') {
      return unit === 'ml' ? '240 ml' : '120 g';
    }

    if (this.measurementStyle === 'tbsp') {
      return unit === 'ml' ? '15 ml' : '12 g';
    }

    return unit === 'ml' ? '5 ml' : '5 g';
  }

  get amountPlaceholder(): string {
    const prefix = this.languageStateService.t('measurementSheet.examplePrefix');

    if (this.convertedUnit === 'ml') {
      return `${prefix} ${this.getDefaultValueForStyle('ml').replace(' ml', '')}`;
    }

    return `${prefix} ${this.getDefaultValueForStyle('g').replace(' g', '')}`;
  }

  private getExampleForSource(
    sourceLabel: string,
    values: { g: string; ml: string }
  ): string {
    const example = this.languageStateService.t('measurementSheet.example');
    const targetValue = this.convertedUnit === 'ml' ? values.ml : values.g;

    return `${example}: ${sourceLabel} → ${targetValue}`;
  }

  private getMeasurementSourceLabel(): string {
    const label = this.languageStateService.t(
      `ingredientRulesPage.measurement${this.measurementStyle === 'cup' ? 'Cup' : this.measurementStyle === 'tbsp' ? 'Tbsp' : 'Tsp'}`
    );

    return `1 ${label}`;
  }
}