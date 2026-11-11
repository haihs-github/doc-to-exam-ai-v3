// Created by Haihs on 12/11/2026
// <app-pager>: Trước/Sau + page numbers + "Tổng N đơn vị · Trang x/y" (port of Pager.jsx + pageButtons).
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

/** Page numbers to show: first, last, current±around; `null` marks a gap. */
export const pageButtons = (page: number, totalPages: number, around = 1): (number | null)[] => {
  if (!(totalPages > 1)) return [];
  const wanted = new Set([1, totalPages]);
  for (let p = page - around; p <= page + around; p += 1)
    if (p >= 1 && p <= totalPages) wanted.add(p);
  const sorted = [...wanted].sort((a, b) => a - b);
  return sorted.flatMap((p, i) => (i > 0 && p - sorted[i - 1] > 1 ? [null, p] : [p]));
};

const BTN =
  'min-h-[48px] min-w-[48px] cursor-pointer rounded-lg border px-3 py-2 text-base disabled:cursor-not-allowed disabled:opacity-40';
const IDLE = 'border-gray-300 hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-gray-700';
const ON =
  'border-primary-700 bg-primary-700 text-white dark:border-sky-400 dark:bg-sky-400 dark:text-gray-900';

@Component({
  selector: 'app-pager',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span>Tổng {{ total() }} {{ unit() }} · Trang {{ page() }}/{{ max(totalPages(), 1) }}</span>
    @if (totalPages() > 1) {
      <nav aria-label="Phân trang" class="flex flex-wrap items-center gap-2">
        <button
          type="button"
          [class]="btn + ' ' + idle"
          [disabled]="disabled() || page() <= 1"
          (click)="pageChange.emit(page() - 1)"
        >
          Trước
        </button>
        @for (p of buttons(); track $index) {
          @if (p === null) {
            <span class="px-1">…</span>
          } @else {
            <button
              type="button"
              [class]="btn + ' ' + (p === page() ? on : idle)"
              [disabled]="disabled()"
              [attr.aria-current]="p === page() ? 'page' : null"
              (click)="p !== page() && pageChange.emit(p)"
            >
              {{ p }}
            </button>
          }
        }
        <button
          type="button"
          [class]="btn + ' ' + idle"
          [disabled]="disabled() || page() >= totalPages()"
          (click)="pageChange.emit(page() + 1)"
        >
          Sau
        </button>
      </nav>
    }
  `,
  host: {
    class:
      'flex flex-wrap items-center justify-between gap-3 text-base text-gray-700 dark:text-gray-300',
  },
})
export class Pager {
  readonly page = input.required<number>();
  readonly totalPages = input.required<number>();
  readonly total = input(0);
  /** Noun after the total ("lớp", "học sinh"...). */
  readonly unit = input('lớp');
  readonly disabled = input(false);
  readonly pageChange = output<number>();
  protected readonly buttons = computed(() => pageButtons(this.page(), this.totalPages()));
  protected readonly max = Math.max;
  protected readonly btn = BTN;
  protected readonly idle = IDLE;
  protected readonly on = ON;
}
