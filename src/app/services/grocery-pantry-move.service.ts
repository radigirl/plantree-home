import { Injectable } from '@angular/core';

import { GroceryService } from './grocery.service';
import { PantryService } from './pantry.service';
import { PantryMoveReviewRow } from '../shared/components/pantry-move-review-dialog/pantry-move-review-dialog.component';
import {
  normalizeIngredientKey,
  parseLeadingNumberIngredient,
} from '../shared/utils/ingredient.util';
import { parseMeasurementStyleIngredient } from '../shared/utils/measurement-style.util';

export interface PantryMoveResult {
  added: number;
  skippedAlwaysPresent: number;
  skippedExistingInferred: number;
  failed: number;
}

@Injectable({
  providedIn: 'root',
})
export class GroceryPantryMoveService {
  constructor(
    private groceryService: GroceryService,
    private pantryService: PantryService
  ) {}

  buildPantryReviewRows(listItems: any[]): PantryMoveReviewRow[] {
    return listItems.map((item) => this.buildPantryMoveDefaultRow(item));
  }

  async moveReviewedRowsToPantry(
    rows: PantryMoveReviewRow[]
  ): Promise<PantryMoveResult> {
    let added = 0;
    let skippedAlwaysPresent = 0;
    let skippedExistingInferred = 0;
    let failed = 0;

    for (const row of rows.filter((item) => item.selected)) {
      const payload = this.buildPantryMovePayload(row);

      if (!payload) {
        failed++;
        continue;
      }

      const result = await this.pantryService.addFromMoveToPantry({
        ...payload,
        isInferredFromList: row.isInferredFromList,
      });

      if (result === 'failed') {
        failed++;
        continue;
      }

      await this.groceryService.updateGroceryItemMovedToPantry(row.id, true);

      if (result === 'added') added++;
      if (result === 'skipped_always_present') skippedAlwaysPresent++;
      if (result === 'skipped_existing_inferred') skippedExistingInferred++;
    }

    return {
      added,
      skippedAlwaysPresent,
      skippedExistingInferred,
      failed,
    };
  }

  buildPantryMovePayload(row: PantryMoveReviewRow) {
    const name = row.pantryName?.trim();

    if (!name) {
      return null;
    }

    if (row.reviewMode === 'measured') {
      return {
        name,
        amount: 1,
        unit: 'measured',
        size_amount: Number(row.measuredAmount),
        size_unit: row.measuredUnit,
        expiry_date: null,
      };
    }

    return {
      name,
      amount: Number(row.countAmount || 1),
      unit: 'item',
      size_amount: row.sizeAmount ? Number(row.sizeAmount) : null,
      size_unit: row.sizeUnit || null,
      expiry_date: null,
    };
  }

  private buildPantryMoveDefaultRow(item: any): PantryMoveReviewRow {
    const sourceName = item.name || '';
    const parsed = this.parsePantryMoveSource(sourceName);
    const isInferred = this.isInferredAggregatedRow(sourceName);

    return {
      id: item.id,
      sourceName,
      selected: true,
      moveAs: parsed.moveAs,
      reviewMode: parsed.moveAs === 'measured' ? 'measured' : 'countable',
      amount: parsed.amount,
      unit: parsed.unit,
      pantryName: parsed.name,
      measuredAmount: parsed.moveAs === 'measured' ? parsed.amount : null,
      measuredUnit: parsed.moveAs === 'measured' ? parsed.unit : 'g',
      countAmount:
        parsed.moveAs === 'countable'
          ? isInferred
            ? null
            : parsed.amount
          : null,
      sizeAmount: null,
      sizeUnit: null,
      isInferredFromList: isInferred,
    };
  }

  private cleanPantryMoveName(name: string): string {
    return name.replace(/^[×xх]\s*/i, '').trim();
  }

  private isInferredAggregatedRow(value: string): boolean {
    return /^\s*\d+(?:[.,]\d+)?\s*[×xх]\s*/i.test(value);
  }

  private parsePantryMoveSource(value: string): {
    moveAs: 'countable' | 'measured';
    amount: number | null;
    unit: string | null;
    name: string;
  } {
    const normalized = normalizeIngredientKey(value);
    const measurementStyle = parseMeasurementStyleIngredient(normalized);

    if (measurementStyle) {
      return {
        moveAs: 'countable',
        amount: null,
        unit: null,
        name: this.cleanPantryMoveName(measurementStyle.ingredient),
      };
    }

    const parsed = parseLeadingNumberIngredient(normalized);

    if (parsed?.unit) {
      return {
        moveAs: 'measured',
        amount: parsed.amount,
        unit: parsed.unit,
        name: this.cleanPantryMoveName(parsed.name || parsed.suffix),
      };
    }

    if (parsed) {
      return {
        moveAs: 'countable',
        amount: parsed.amount,
        unit: null,
        name: this.cleanPantryMoveName(parsed.name),
      };
    }

    return {
      moveAs: 'countable',
      amount: null,
      unit: null,
      name: normalized,
    };
  }
}