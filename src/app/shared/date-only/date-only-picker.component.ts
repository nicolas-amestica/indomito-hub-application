import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  forwardRef,
  inject,
  input,
} from '@angular/core';
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR } from '@angular/forms';
import { DatePicker } from 'primeng/datepicker';
import { dateOnlyToLocalDate, localDateToDateOnly } from './date-only';

/** Adaptador PrimeNG que mantiene el contrato HTTP como YYYY-MM-DD sin convertirlo a UTC. */
@Component({
  selector: 'app-date-only-picker',
  imports: [DatePicker, FormsModule],
  template: `
    <p-datepicker
      [inputId]="inputId()"
      [ngModel]="date"
      (ngModelChange)="change($event)"
      (onBlur)="touch()"
      dateFormat="dd-mm-yy"
      [showIcon]="true"
      [showButtonBar]="true"
      [fluid]="true"
      [disabled]="disabled"
      [placeholder]="placeholder()"
      appendTo="body"
    />
  `,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => DateOnlyPickerComponent),
      multi: true,
    },
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DateOnlyPickerComponent implements ControlValueAccessor {
  private readonly changeDetector = inject(ChangeDetectorRef);
  readonly inputId = input.required<string>();
  readonly placeholder = input('DD-MM-AAAA');
  protected date: Date | null = null;
  protected disabled = false;
  private onChange: (value: string) => void = () => undefined;
  protected touch: () => void = () => undefined;

  writeValue(value: string | null): void {
    this.date = dateOnlyToLocalDate(value);
    this.changeDetector.markForCheck();
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.touch = fn;
  }

  setDisabledState(disabled: boolean): void {
    this.disabled = disabled;
    this.changeDetector.markForCheck();
  }

  protected change(value: Date | null): void {
    this.date = value;
    this.onChange(localDateToDateOnly(value));
  }
}
