import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface MergeCandidate {
  singularItems: string[];
  pluralItem: string;
  singularText: string;
  pluralText: string;
  similarity: number;
}

@Component({
  selector: 'app-merge-review-sheet',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './merge-review-sheet.component.html',
  styleUrls: ['./merge-review-sheet.component.scss'],
})
export class MergeReviewSheetComponent {
  @Input() candidates: MergeCandidate[] = [];

  @Output() apply = new EventEmitter<MergeCandidate[]>();
  @Output() cancel = new EventEmitter<void>();

  // checkbox state (default all checked)
  selectedMap: Record<number, boolean> = {};

  ngOnInit(): void {
    this.candidates.forEach((_, index) => {
      this.selectedMap[index] = true;
    });
  }

  toggle(index: number): void {
    this.selectedMap[index] = !this.selectedMap[index];
  }

  get hasSelected(): boolean {
  return Object.values(this.selectedMap).some(Boolean);
}

  onApply(): void {
    const selected = this.candidates.filter(
      (_, index) => this.selectedMap[index]
    );
    this.apply.emit(selected);
  }

  onCancel(): void {
    this.cancel.emit();
  }
  
}