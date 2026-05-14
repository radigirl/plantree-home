import { CommonModule } from '@angular/common';
import {
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  NgZone,
  OnChanges,
  Output,
  SimpleChanges,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PantryItem } from '../../../models/pantry-item.model';
import { CalendarDays, LucideAngularModule } from 'lucide-angular';
import { ToggleSwitchComponent } from '../toggle-switch/toggle-switch.component';
import { CalendarPickerComponent } from '../calendar-picker/calendar-picker.component';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { LanguageStateService } from '../../../services/language.state.service';

export interface PantryItemSheetValue {
  name: string;
  amount: number;
  unit: 'item' | 'measured';
  size_amount: number | null;
  size_unit: string | null;
  expiry_date: string | null;
}

@Component({
  selector: 'app-pantry-item-sheet',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule, ToggleSwitchComponent, CalendarPickerComponent, TranslatePipe],
  templateUrl: './pantry-item-sheet.component.html',
  styleUrls: ['./pantry-item-sheet.component.scss'],
})
export class PantryItemSheetComponent implements OnChanges {
  private readonly DESKTOP_BREAKPOINT = 1024;

  @Input() isOpen = false;
  @Input() mode: 'add' | 'edit' = 'add';
  @Input() item: PantryItem | null = null;

  @Output() closed = new EventEmitter<void>();
  @Output() saved = new EventEmitter<PantryItemSheetValue>();

  name = '';
  amount = 1;
  type: 'countable' | 'measured' = 'countable';
  sizeAmount: number | null = null;
  sizeUnit = '';
  expiryDate: string | null = null;
  errorMessage = '';
  hasTriedSave = false;
  nameErrorMessage = '';
  isCalendarOpen = false;
  selectedCalendarDates: string[] = [];
  private isClosingCalendar = false;

  readonly calendarIcon = CalendarDays;

  constructor(
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone,
    private languageStateService: LanguageStateService
  ) { }

  get isDesktop(): boolean {
    return window.innerWidth >= this.DESKTOP_BREAKPOINT;
  }

  get title(): string {
    return this.mode === 'add'
      ? this.languageStateService.t('pantrySheet.addTitle')
      : this.languageStateService.t('pantrySheet.editTitle');
  }

  get submitLabel(): string {
    return this.mode === 'add'
      ? this.languageStateService.t('common.add')
      : this.languageStateService.t('mealDialog.save');
  }

  get createdAtLabel(): string {
    if (!this.item?.created_at) return '';
    return new Date(this.item.created_at).toLocaleDateString();
  }

  get unitOptions(): string[] {
    return ['g', 'kg', 'ml', 'l'];
  }

  get sizePlaceholder(): string {
    if (!this.sizeUnit) {
      return '—';
    }

    const examplePrefix = this.languageStateService.t('measurementSheet.examplePrefix');

    if (this.sizeUnit === 'g' || this.sizeUnit === 'ml') {
      return `${examplePrefix} 500`;
    }

    return `${examplePrefix} 1`;
  }

  onTypeChange(value: string): void {
    if (value !== 'countable' && value !== 'measured') {
      return;
    }

    const previousType = this.type;
    this.type = value;

    // When switching from measured -> countable,
    // clear measured-only values so they don't stay in the form.
    if (previousType === 'measured' && this.type === 'countable') {
      this.sizeUnit = '';
      this.sizeAmount = null;
    }

    this.updateSizeUnitError();
  }

  onSizeUnitChange(value: string): void {
    this.sizeUnit = value;

    if (!value) {
      this.sizeAmount = null;
    }

    this.updateSizeUnitError();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isOpen'] || changes['mode'] || changes['item']) {
      this.patchFormFromInputs();
    }
  }

  close(): void {
    this.closed.emit();
  }

  onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.close();
    }
  }

  updateSizeUnitError(): void {
    if (!this.hasTriedSave) {
      this.errorMessage = '';
      return;
    }

    const hasSize =
      this.sizeAmount !== null &&
      this.sizeAmount !== undefined &&
      this.sizeAmount !== 0;

    const hasUnit = !!this.sizeUnit?.trim();

    if (this.type === 'measured') {
      if (!hasSize && !hasUnit) {
        this.errorMessage = this.languageStateService.t('pantrySheet.selectUnitAndSize');
        return;
      }
      if (!hasUnit) {
        this.errorMessage = this.languageStateService.t('pantrySheet.selectUnitError');
        return;
      }
      if (!hasSize) {
        this.errorMessage = this.languageStateService.t('pantrySheet.enterSizeError');
        return;
      }
      this.errorMessage = '';
      return;
    }
    if (hasSize && !hasUnit) {
      this.errorMessage = this.languageStateService.t('pantrySheet.selectUnitError');
      return;
    }
    if (!hasSize && hasUnit) {
      this.errorMessage = this.languageStateService.t('pantrySheet.enterSizeError');
      return;
    }
    this.errorMessage = '';
  }

  updateNameError(): void {
    if (!this.hasTriedSave) {
      this.nameErrorMessage = '';
      return;
    }
    this.nameErrorMessage = this.name.trim()
      ? ''
      : this.languageStateService.t('pantrySheet.enterNameError');
  }

  save(): void {
    this.hasTriedSave = true;

    this.updateNameError();
    this.updateSizeUnitError();

    if (this.nameErrorMessage || this.errorMessage) {
      return;
    }

    const trimmedName = this.name.trim();

    if (!Number.isFinite(this.amount) || this.amount < 1) {
      return;
    }

    const hasSize =
      this.sizeAmount !== null &&
      this.sizeAmount !== undefined &&
      this.sizeAmount !== 0;

    const hasUnit = !!this.sizeUnit?.trim();

    this.saved.emit({
      name: trimmedName,
      amount: Math.floor(this.amount),
      unit: this.type === 'measured' ? 'measured' : 'item',
      size_amount: hasSize ? this.sizeAmount : null,
      size_unit: hasUnit ? this.sizeUnit.trim() : null,
      expiry_date: this.expiryDate || null,
    });
  }

  private patchFormFromInputs(): void {
    if (!this.isOpen) {
      return;
    }

    this.hasTriedSave = false;
    this.errorMessage = '';
    this.nameErrorMessage = '';

    if (this.mode === 'edit' && this.item) {
      this.name = this.item.name ?? '';
      this.amount = this.item.amount ?? 1;
      this.type = this.item.unit === 'measured' ? 'measured' : 'countable';
      this.sizeAmount = this.item.size_amount ?? null;
      this.sizeUnit = this.item.size_unit ?? '';
      this.expiryDate = this.toDateInputValue(this.item.expiry_date);

      return;
    }

    this.name = '';
    this.amount = 1;
    this.type = 'countable';
    this.sizeAmount = null;
    this.sizeUnit = '';
    this.expiryDate = '';
    this.hasTriedSave = false;
    this.errorMessage = '';
    this.nameErrorMessage = '';
  }

  private toDateInputValue(value?: string | null): string {
    if (!value) return '';
    return value.slice(0, 10);
  }


  // calendar
  openCalendar(): void {
    if (this.isCalendarOpen) {
      return;
    }

    this.isCalendarOpen = true;

    this.selectedCalendarDates = this.expiryDate
      ? [this.expiryDate]
      : [];

    document.body.style.overflow = 'hidden';
  }

  closeCalendar(): void {
    this.isClosingCalendar = true;
    this.isCalendarOpen = false;
    this.selectedCalendarDates = [];
    document.body.style.overflow = '';

    setTimeout(() => {
      this.isClosingCalendar = false;
    }, 220);
  }

  onCalendarDatesChange(dates: string[]): void {
    this.selectedCalendarDates = dates;

    if (dates.length) {
      void this.confirmCalendarDates(dates);
    }
  }

  async confirmCalendarDates(dates: string[]): Promise<void> {
    if (!dates.length) {
      return;
    }

    this.expiryDate = dates[0];

    // let the selected state be visible briefly
    await new Promise((resolve) => setTimeout(resolve, 260));

    this.ngZone.run(() => {
      this.isCalendarOpen = false;
      this.selectedCalendarDates = [];
      document.body.style.overflow = '';
      this.cdr.detectChanges();
    });
  }

  private getTodayAtStart(): Date {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  }

  private formatDateForInput(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  formatDateForDisplay(dateStr: string | null): string {
    if (!dateStr) return '';
    const [year, month, day] = dateStr.split('-');
    if (!year || !month || !day) return '';
    return `${day}-${month}-${year}`;
  }



  onCalendarBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.closeCalendar();
    }
  }



}