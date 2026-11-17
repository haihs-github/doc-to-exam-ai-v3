// Created by Haihs on 17/11/2026
// <app-filter-panel>: nút "Bộ lọc (n)" bật/tắt panel chiếu nội dung lọc; dùng với class .filter-panel.
import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';
import { Icon } from './icon';

@Component({
  selector: 'app-filter-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon],
  template: `
    <button
      type="button"
      class="btn-secondary"
      [attr.aria-expanded]="open()"
      (click)="open.set(!open())"
    >
      <app-icon name="filter" svgClass="h-4 w-4" />
      <span>{{ toolbarLabel() }}</span>
      @if (count() > 0) {
        <span class="badge bg-primary-700 text-white dark:bg-primary-400 dark:text-gray-900">{{ count() }}</span>
      }
    </button>
    @if (open()) {
      <div class="filter-panel mt-2">
        <button
          type="button"
          class="btn-ghost float-right"
          aria-label="Đóng bộ lọc"
          (click)="open.set(false)"
        >
          <app-icon name="x" svgClass="h-4 w-4" />
        </button>
        <ng-content />
      </div>
    }
  `,
  host: { class: 'block' },
})
export class FilterPanel {
  readonly open = model<boolean>(false);
  readonly toolbarLabel = input<string>('Bộ lọc');
  readonly count = input<number>(0);
}
