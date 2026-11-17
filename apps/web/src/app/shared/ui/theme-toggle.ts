// Created by Haihs on 11/11/2026
// <app-theme-toggle>: light/dark switch through applyTheme (port of ThemeToggle.jsx).
// TODO(web): chia sẻ signal theme giữa nhiều ThemeToggle (navbar hiện có thể mount 2 nút lệch trạng thái)
import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { applyTheme } from '../../theme';

@Component({
  selector: 'app-theme-toggle',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- Haihs: nút theme đọc được trên thanh trên xanh - start -->
    <!-- đóng code cũ -->
    <!-- <button -->
    <!-- type="button" -->
    <!-- (click)="toggle()" -->
    <!-- [attr.title]="label() + ' (bấm để đổi)'" -->
    <!-- [attr.aria-label]="label() + '. Bấm để đổi chế độ'" -->
    <!-- class="inline-flex h-12 w-12 cursor-pointer items-center justify-center rounded-full text-gray-700 transition-colors hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800" -->
    <!-- > -->
    <button
      type="button"
      (click)="toggle()"
      [attr.title]="label() + ' (bấm để đổi)'"
      [attr.aria-label]="label() + '. Bấm để đổi chế độ'"
      class="inline-flex h-12 w-12 cursor-pointer items-center justify-center rounded-full text-white transition-colors hover:bg-white/15"
    >
      <!-- Haihs: nút theme đọc được trên thanh trên xanh - end -->
      <svg
        class="h-6 w-6"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        aria-hidden="true"
      >
        @if (dark()) {
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
        } @else {
          <circle cx="12" cy="12" r="4" />
          <path
            d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"
          />
        }
      </svg>
    </button>
  `,
})
export class ThemeToggle {
  // The host page script already applied the saved/system theme before first paint, so the class is the truth.
  protected readonly dark = signal(document.documentElement.classList.contains('dark'));
  protected readonly label = () => (this.dark() ? 'Giao diện tối' : 'Giao diện sáng');

  protected toggle(): void {
    const next = !this.dark();
    applyTheme(next ? 'dark' : 'light');
    this.dark.set(next);
  }
}
