// Created by Haihs on 15/11/2026
// <app-datetime-field>: dd/mm/yyyy hh:mm masked input (UTC+7) with a calendar button that opens <app-datetime-picker>. Port of DateTimeField.jsx; meant to sit inside <app-form-field>.
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  input,
  model,
  signal,
} from '@angular/core';
import { maskVnDateTime } from '../utils/vn-datetime';
import { DatetimePicker } from './datetime-picker';
import { Icon } from './icon';

/** dd/mm/yyyy hh:mm -> yyyy-MM-ddTHH:mm ('' unless the text is complete). */
export const textToPicker = (text: string): string => {
  const m = /^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2})$/.exec(text);
  return m ? `${m[3]}-${m[2]}-${m[1]}T${m[4]}:${m[5]}` : '';
};
/** yyyy-MM-ddTHH:mm -> dd/mm/yyyy hh:mm ('' on anything else). */
export const pickerToText = (value: string): string => {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  return m ? `${m[3]}/${m[2]}/${m[1]} ${m[4]}:${m[5]}` : '';
};

@Component({
  selector: 'app-datetime-field',
  imports: [Icon, DatetimePicker],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'relative block' },
  template: `
    <input
      class="input pr-12"
      type="text"
      inputmode="numeric"
      autocomplete="off"
      placeholder="dd/mm/yyyy hh:mm"
      maxlength="16"
      [attr.name]="name() || null"
      [value]="value()"
      [readOnly]="readOnly()"
      (input)="onType($event)"
    />
    @if (!readOnly()) {
      <button
        type="button"
        (click)="open.set(!open())"
        aria-label="Chọn ngày giờ"
        aria-haspopup="dialog"
        [attr.aria-expanded]="open()"
        title="Chọn ngày giờ"
        class="absolute right-1 top-1/2 inline-flex h-11 w-11 -translate-y-1/2 cursor-pointer items-center justify-center rounded-lg text-gray-600 hover:text-primary-700 dark:text-gray-300 dark:hover:text-sky-300"
      >
        <app-icon name="calendar-days" svgClass="h-5 w-5" />
      </button>
      @if (open()) {
        <app-datetime-picker
          [value]="pickerValue()"
          [anchor]="host.nativeElement"
          (valueChange)="value.set(pickerToText($event))"
          (closed)="open.set(false)"
        />
      }
    }
  `,
})
export class DatetimeField {
  /** dd/mm/yyyy hh:mm text (the form state of the sitting pages). */
  readonly value = model('');
  readonly name = input('');
  readonly readOnly = input(false);
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  protected readonly open = signal(false);
  protected readonly pickerValue = () => textToPicker(this.value());
  protected readonly pickerToText = pickerToText;

  protected onType(e: Event): void {
    this.value.set(maskVnDateTime((e.target as HTMLInputElement).value));
  }
}
