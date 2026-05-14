import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { parseMeasurementStyleIngredient } from '../../../../shared/utils/measurement-style.util';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { LanguageStateService } from '../../../../services/language.state.service';

export interface MeasurementConversionValue {
  amount: number;
  unit: string;
  remember: boolean;
}

@Component({
  selector: 'app-measurement-conversion-sheet',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe],
  templateUrl: './measurement-conversion-sheet.component.html',
  styleUrls: ['./measurement-conversion-sheet.component.scss'],
})
export class MeasurementConversionSheetComponent {
  @Input() itemName = '';
  @Input() existingMatchLabel: string | null = null;

  @Output() apply = new EventEmitter<MeasurementConversionValue>();
  @Output() skip = new EventEmitter<void>();
  @Output() closed = new EventEmitter<void>();

  amount: number | null = null;
  unit = '';
  remember = false;

  readonly unitOptions: string[] = ['g', 'kg', 'ml', 'l'];

  constructor(private languageStateService: LanguageStateService) { }


  get mergeResultHint(): string {
    if (this.amount === null || this.amount === undefined || !this.unit) {
      return '';
    }

    if (this.existingMatchLabel) {
      return this.languageStateService
        .t('measurementSheet.willBeAddedTo')
        .replace('{{name}}', this.existingMatchLabel);
    }

    return this.languageStateService.t('measurementSheet.willCreateNewItem');
  }

  get parsedStyle() {
    return parseMeasurementStyleIngredient(this.itemName);
  }

  get currentExampleHint(): string {
    const style = this.parsedStyle?.style;

    if (style === 'cup') {
      return this.getExampleForSource('1 cup', {
        g: '120 g',
        kg: '0.12 kg',
        ml: '240 ml',
        l: '0.24 l',
      });
    }

    if (style === 'tbsp') {
      return this.getExampleForSource('1 tbsp', {
        g: '12 g',
        kg: '0.012 kg',
        ml: '15 ml',
        l: '0.015 l',
      });
    }

    if (style === 'tsp') {
      return this.getExampleForSource('1 tsp', {
        g: '5 g',
        kg: '0.005 kg',
        ml: '5 ml',
        l: '0.005 l',
      });
    }

    return this.unit === 'ml' || this.unit === 'l'
      ? this.languageStateService.t('measurementSheet.convertToVolume')
      : this.languageStateService.t('measurementSheet.convertToWeight');
  }

  get amountPlaceholder(): string {
    const style = this.parsedStyle?.style;

    if (style === 'cup') {
      return this.getPlaceholderForValues({
        g: '120',
        kg: '0.12',
        ml: '240',
        l: '0.24',
      });
    }

    if (style === 'tbsp') {
      return this.getPlaceholderForValues({
        g: '12',
        kg: '0.012',
        ml: '15',
        l: '0.015',
      });
    }

    if (style === 'tsp') {
      return this.getPlaceholderForValues({
        g: '5',
        kg: '0.005',
        ml: '5',
        l: '0.005',
      });
    }

    return this.unit === 'ml' || this.unit === 'l' ? 'e.g. 240' : 'e.g. 120';
  }

  private getPlaceholderForValues(values: {
    g: string;
    kg: string;
    ml: string;
    l: string;
  }): string {
    const prefix = this.languageStateService.t('measurementSheet.examplePrefix');

    switch (this.unit) {
      case 'kg':
        return `${prefix} ${values.kg}`;

      case 'ml':
        return `${prefix} ${values.ml}`;

      case 'l':
        return `${prefix} ${values.l}`;

      case 'g':
      case '':
      default:
        return `${prefix} ${values.g}`;
    }
  }

  onApply(): void {
    if (this.amount === null || !this.unit) {
      return;
    }

    this.apply.emit({
      amount: Number(this.amount),
      unit: this.unit,
      remember: this.remember,
    });
  }

  onSkip(): void {
    this.skip.emit();
  }

  onClose(): void {
    this.closed.emit();
  }

  private getExampleForSource(
    sourceLabel: string,
    values: { g: string; kg: string; ml: string; l: string }
  ): string {
    const example = this.languageStateService.t('measurementSheet.example');

    switch (this.unit) {
      case 'kg':
        return `${example}: ${sourceLabel} → ${values.kg}`;

      case 'ml':
        return `${example}: ${sourceLabel} → ${values.ml}`;

      case 'l':
        return `${example}: ${sourceLabel} → ${values.l}`;

      case 'g':
      case '':
      default:
        return `${example}: ${sourceLabel} → ${values.g}`;
    }
  }
}