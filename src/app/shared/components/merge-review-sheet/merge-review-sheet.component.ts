import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

export interface MergeCandidate {
  singularItems: string[];
  pluralItem: string;
  singularText: string;
  pluralText: string;
  similarity: number;
}

export interface MergeApplyValue {
  selectedCandidates: MergeCandidate[];
  remember: boolean;
}

@Component({
  selector: 'app-merge-review-sheet',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './merge-review-sheet.component.html',
  styleUrls: ['./merge-review-sheet.component.scss'],
})
export class MergeReviewSheetComponent {
  @Input() candidates: MergeCandidate[] = [];

  @Output() mergeApplied = new EventEmitter<MergeApplyValue>();
  @Output() dismissed = new EventEmitter<void>();
  @Output() skipped = new EventEmitter<void>();

  selectedMap: Record<number, boolean> = {};
  remember = true;

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
    const selectedCandidates = this.candidates.filter(
      (_, index) => this.selectedMap[index]
    );

    this.mergeApplied.emit({
      selectedCandidates,
      remember: this.remember,
    });
  }

  onDismiss(): void {
    this.dismissed.emit();
  }

  onSkip(): void {
    this.skipped.emit();
  }
}