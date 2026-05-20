import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';

@Component({
  selector: 'app-manage-ingredient-rules-page',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  templateUrl: './manage-ingredient-rules-page.component.html',
  styleUrl: './manage-ingredient-rules-page.component.scss',
})
export class ManageIngredientRulesPageComponent {
  wordRules = [
    { id: '1', singular: 'ябълка', plural: 'ябълки' },
    { id: '2', singular: 'морков', plural: 'моркова' },
  ];

  measurementRules = [
    { id: '1', ingredient: 'брашно', style: 'cup', amount: 120, unit: 'g' },
    { id: '2', ingredient: 'брашно', style: 'tbsp', amount: 12, unit: 'g' },
  ];

  onAddWordRule(): void {
    console.log('Add word rule');
  }

  onEditWordRule(rule: any): void {
    console.log('Edit word rule:', rule);
  }

  onDeleteWordRule(rule: any): void {
    console.log('Delete word rule:', rule);
  }

  onAddMeasurementRule(): void {
    console.log('Add measurement rule');
  }

  onEditMeasurementRule(rule: any): void {
    console.log('Edit measurement rule:', rule);
  }

  onDeleteMeasurementRule(rule: any): void {
    console.log('Delete measurement rule:', rule);
  }

  formatMeasurementRule(rule: {
    style: string;
    amount: number;
    unit: string;
  }): string {
    return `1 ${rule.style} = ${rule.amount} ${rule.unit}`;
  }

}