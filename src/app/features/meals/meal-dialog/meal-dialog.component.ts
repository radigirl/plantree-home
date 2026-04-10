import { ChangeDetectorRef, Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Meal } from '../../../models/meal.model';
import { FormsModule } from '@angular/forms';
import { OnChanges, SimpleChanges } from '@angular/core';

@Component({
  selector: 'app-meal-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './meal-dialog.component.html',
  styleUrl: './meal-dialog.component.scss',
})
export class MealDialogComponent implements OnChanges {
  @Input() isOpen = false;
  @Input() mode: 'create' | 'edit' | 'createFromExisting' = 'create';

  // Optional initial data (for edit / create from existing)
  @Input() initialMeal: Meal | null = null;

  @Output() close = new EventEmitter<void>();
  @Output() save = new EventEmitter<{
    mealName: string;
    prepTime: number | null;
    ingredients: string[];
    instructions: string;
    imageFile: File | null;
    mode: 'create' | 'edit' | 'createFromExisting';
  }>();

  mealName = '';
  prepTime: number | null = null;
  ingredientsText = '';
  instructions = '';

  selectedImageFile: File | null = null;
  selectedImagePreview: string | null = null;
  imageName: string | null = null;
  isSaving = false;

  constructor(private cdr: ChangeDetectorRef) { }


  onOverlayClick(): void {
    this.onCancel();
  }

 ngOnChanges(changes: SimpleChanges): void {
  if (changes['isOpen'] && !this.isOpen) {
    this.isSaving = false;
    return;
  }
  if (!this.isOpen) {
    return;
  }
  if (this.mode === 'edit' || this.mode === 'createFromExisting') {
    if (this.initialMeal) {
      this.mealName = this.initialMeal.name || '';
      this.prepTime = this.initialMeal.prepTime ?? null;
      this.ingredientsText = (this.initialMeal.ingredients || []).join(', ');
      this.instructions = this.initialMeal.instructions || '';

      this.selectedImagePreview = this.initialMeal.image_url || null;
      this.selectedImageFile = null;
      this.imageName = this.initialMeal.image_url
        ? this.initialMeal.image_url.split('/').pop() || 'image'
        : null;
    }
    return;
  }
  if (this.mode === 'create') {
    this.resetForm();
  }
}

 resetForm(): void {
  this.mealName = '';
  this.prepTime = null;
  this.ingredientsText = '';
  this.instructions = '';
  this.selectedImageFile = null;
  this.selectedImagePreview = null;
  this.imageName = null;
}

  onMealImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;

    if (!file) {
      this.selectedImageFile = null;
      this.selectedImagePreview = null;
      this.imageName = null;
      this.cdr.detectChanges();
      return;
    }

    this.selectedImageFile = file;
    this.imageName = file.name;

    const reader = new FileReader();
    reader.onload = () => {
      this.selectedImagePreview = reader.result as string;
      this.cdr.detectChanges();
    };
    reader.readAsDataURL(file);
  }

  removeSelectedMealImage(): void {
    this.selectedImageFile = null;
    this.selectedImagePreview = null;
    this.imageName = null;
    this.cdr.detectChanges();
  }

  onCancel(): void {
    this.close.emit();
  }


  onSave(): void {
  if (this.isSaving) return;

  this.isSaving = true;

  this.save.emit({
  mealName: this.mealName,
  prepTime: this.prepTime,
  ingredients: this.ingredientsText
    .split(',')
    .map(i => i.trim())
    .filter(i => i),
  instructions: this.instructions,
  imageFile: this.selectedImageFile,
  mode: this.mode,
});
}

}