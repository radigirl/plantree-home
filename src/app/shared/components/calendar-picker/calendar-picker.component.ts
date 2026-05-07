import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { LanguageStateService } from '../../../services/language.state.service';
import { TranslatePipe } from '../../pipes/translate.pipe';


@Component({
  selector: 'app-calendar-picker',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  templateUrl: './calendar-picker.component.html',
  styleUrls: ['./calendar-picker.component.scss'],
})
export class CalendarPickerComponent implements OnChanges {
  @Input() title = 'Pick a date';
  @Input() selectionMode: 'single' | 'multiple' = 'single';
  @Input() selectedDates: string[] = [];
  @Input() disablePastDates = true;
  @Input() confirmLabel = 'Confirm';
  @Input() autoConfirmOnSingleSelect = false;
  @Input() showFooterActions = true;

  @Output() selectedDatesChange = new EventEmitter<string[]>();
  @Output() confirm = new EventEmitter<string[]>();
  @Output() cancel = new EventEmitter<void>();

  currentMonth = new Date();
  calendarDays: any[] = [];

  constructor(private languageStateService: LanguageStateService) { }


  ngOnInit(): void {
    this.buildCalendar();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['selectedDates'] || changes['selectionMode']) {
      this.buildCalendar();
    }
  }

  get weekdayLabels(): string[] {
    return this.languageStateService.t('daysShortMondayFirst') as unknown as string[];
  }

  previousMonth(): void {
    this.currentMonth = new Date(
      this.currentMonth.getFullYear(),
      this.currentMonth.getMonth() - 1,
      1
    );
    this.buildCalendar();
  }

  nextMonth(): void {
    this.currentMonth = new Date(
      this.currentMonth.getFullYear(),
      this.currentMonth.getMonth() + 1,
      1
    );
    this.buildCalendar();
  }

  selectDay(day: any): void {
    if (day.isPast || !day.isCurrentMonth) {
      return;
    }

    if (this.selectionMode === 'single') {
      this.selectedDates = [day.dateKey];
      this.selectedDatesChange.emit(this.selectedDates);
      this.buildCalendar();

      if (this.autoConfirmOnSingleSelect) {
        this.confirm.emit(this.selectedDates);
      }

      return;
    }

    if (this.selectedDates.includes(day.dateKey)) {
      this.selectedDates = this.selectedDates.filter((d) => d !== day.dateKey);
    } else {
      this.selectedDates = [...this.selectedDates, day.dateKey];
    }

    this.selectedDatesChange.emit(this.selectedDates);
    this.buildCalendar();
  }

  onConfirm(): void {
    if (!this.selectedDates.length) {
      return;
    }

    this.confirm.emit(this.selectedDates);
  }

  onCancel(): void {
    this.cancel.emit();
  }

  get monthLabel(): string {
    const months = this.languageStateService.t('monthsLong') as unknown as string[];
    return `${months[this.currentMonth.getMonth()]} ${this.currentMonth.getFullYear()}`;
  }

  private buildCalendar(): void {
    const year = this.currentMonth.getFullYear();
    const month = this.currentMonth.getMonth();

    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);

    const mondayBasedStart = (firstDayOfMonth.getDay() + 6) % 7;
    const daysInMonth = lastDayOfMonth.getDate();

    const days: any[] = [];

    for (let i = 0; i < mondayBasedStart; i++) {
      const date = new Date(year, month, i - mondayBasedStart + 1);
      days.push(this.createCalendarDay(date, false));
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      days.push(this.createCalendarDay(date, true));
    }

    while (days.length % 7 !== 0) {
      const extraDay = days.length - (mondayBasedStart + daysInMonth) + 1;
      const date = new Date(year, month + 1, extraDay);
      days.push(this.createCalendarDay(date, false));
    }

    this.calendarDays = days;
  }

  private createCalendarDay(date: Date, isCurrentMonth: boolean) {
    const dateKey = this.formatDateLocal(date);
    const todayKey = this.formatDateLocal(new Date());

    return {
      date,
      dateKey,
      dayNumber: date.getDate(),
      isCurrentMonth,
      isPast: this.disablePastDates && dateKey < todayKey,
      isSelected: this.selectedDates.includes(dateKey),
      isToday: dateKey === todayKey,
    };
  }

  private formatDateLocal(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}