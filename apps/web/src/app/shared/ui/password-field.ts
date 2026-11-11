// Created by Haihs on 11/11/2026
// <app-password-field>: password input with a show/hide button (port of PasswordField.jsx + passwordVisibility.js).
import { ChangeDetectionStrategy, Component, input, model, signal } from '@angular/core';

@Component({
  selector: 'app-password-field',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <input
      class="input pr-12"
      [type]="visible() ? 'text' : 'password'"
      [value]="value()"
      (input)="value.set($any($event.target).value)"
      [attr.autocomplete]="autocomplete()"
      [attr.placeholder]="placeholder() || null"
      [attr.name]="name() || null"
      [disabled]="disabled()"
    />
    <button
      type="button"
      (click)="visible.set(!visible())"
      [attr.aria-label]="visible() ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'"
      [attr.aria-pressed]="visible()"
      class="absolute right-0 top-1/2 flex h-12 w-12 -translate-y-1/2 cursor-pointer items-center justify-center rounded-lg text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
    >
      <svg
        class="h-5 w-5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        aria-hidden="true"
      >
        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
        <circle cx="12" cy="12" r="3" />
        @if (visible()) {
          <path d="M3 3l18 18" />
        }
      </svg>
    </button>
  `,
  host: { class: 'relative block' },
})
export class PasswordField {
  readonly value = model('');
  readonly autocomplete = input('current-password');
  readonly placeholder = input('');
  readonly name = input('');
  readonly disabled = input(false);
  protected readonly visible = signal(false);
}
